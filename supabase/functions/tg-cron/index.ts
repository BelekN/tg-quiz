// Периодический крон (см. настройку pg_cron -> pg_net в 007_push_notifications.sql).
// В отличие от tg-api, здесь нет пользователя и initData — вызывает
// только сам Postgres по расписанию, поэтому авторизация другая:
// общий секрет в заголовке, а не подпись Telegram.
//
// Деплой:
//   supabase functions deploy tg-cron --no-verify-jwt
//   supabase secrets set CRON_SECRET=... BOT_USERNAME=... APP_SHORT_NAME=...

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  appDeepLink,
  escapeHtml,
  sendTelegramMessage,
  timingSafeEqual,
} from "../_shared/telegramNotify.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN")!;
const BOT_USERNAME = Deno.env.get("BOT_USERNAME") ?? "";
const APP_SHORT_NAME = Deno.env.get("APP_SHORT_NAME") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// A/B на формулировки — только у retention-пушей (напоминания), не у
// транзакционных (итог дуэли — там текст сообщает факт, не убеждает).
// Вариант выбирается детерминированно от tg_id: один и тот же
// пользователь всегда попадает в один и тот же вариант — иначе
// сравнение вариантов между собой не имеет смысла.
const DUEL_REMINDER_VARIANTS = [
  "⏳ Никто пока не принял твой вызов на дуэль. Пригласи ещё раз — вопросы те же ждут соперника.",
  "👀 Твой вызов на дуэль всё ещё висит без ответа. Скинь ссылку другому другу?",
];

const INACTIVITY_VARIANTS = [
  (name: string) => `🧠 ${name}новые дуэли и вопросы уже ждут. Загляни на разок!`,
  (name: string) => `🎮 ${name}соперники заждались реванша. Есть 2 минуты?`,
];

function pickVariant(tgId: number, count: number) {
  return Math.abs(tgId) % count;
}

async function logPushSent(tgId: number, pushType: string, variant: number) {
  await supabase.rpc("log_event", {
    p_tg_id: tgId,
    p_name: "push_sent",
    p_payload: { push_type: pushType, variant },
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (!timingSafeEqual(req.headers.get("x-cron-secret") ?? "", CRON_SECRET)) {
    return new Response("UNAUTHORIZED", { status: 401 });
  }

  // ---- пуш №2: дуэль 3+ часа висит без гостя ----
  const { data: duelReminders, error: duelErr } = await supabase.rpc(
    "get_duel_reminders",
    { p_limit: 50 },
  );
  if (duelErr) console.error("get_duel_reminders failed", duelErr);

  for (const r of duelReminders ?? []) {
    const variant = pickVariant(r.tg_id, DUEL_REMINDER_VARIANTS.length);
    await sendTelegramMessage(
      BOT_TOKEN,
      r.tg_id,
      DUEL_REMINDER_VARIANTS[variant],
      { text: "Пригласить друга", url: appDeepLink(BOT_USERNAME, APP_SHORT_NAME, `duel_${r.duel_id}`) },
    ).catch(() => {});
    await logPushSent(r.tg_id, "duel_reminder", variant);
  }

  // ---- пуш №3: не заходил 24+ часа (тайминг уже "умный" — см.
  // get_inactivity_reminders: ждёт привычный час пользователя, если
  // есть история открытий) ----
  const { data: inactiveReminders, error: inactiveErr } = await supabase.rpc(
    "get_inactivity_reminders",
    { p_limit: 50 },
  );
  if (inactiveErr) console.error("get_inactivity_reminders failed", inactiveErr);

  for (const r of inactiveReminders ?? []) {
    const name = r.first_name ? `${escapeHtml(r.first_name)}, ` : "";
    const variant = pickVariant(r.tg_id, INACTIVITY_VARIANTS.length);
    await sendTelegramMessage(
      BOT_TOKEN,
      r.tg_id,
      INACTIVITY_VARIANTS[variant](name),
      { text: "Открыть викторину", url: APP_URL, webApp: true },
    ).catch(() => {});
    await logPushSent(r.tg_id, "inactivity_nudge", variant);
  }

  return new Response(
    JSON.stringify({
      duel_reminders: duelReminders?.length ?? 0,
      inactivity_reminders: inactiveReminders?.length ?? 0,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
