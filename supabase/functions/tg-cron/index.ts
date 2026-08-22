// Периодический крон (см. настройку pg_cron -> pg_net в 007_push_notifications.sql).
// В отличие от tg-api, здесь нет пользователя и initData — вызывает
// только сам Postgres по расписанию, поэтому авторизация другая:
// общий секрет в заголовке, а не подпись Telegram.
//
// Деплой:
//   supabase functions deploy tg-cron --no-verify-jwt
//   supabase secrets set CRON_SECRET=... BOT_USERNAME=... APP_SHORT_NAME=...

import { createClient } from "jsr:@supabase/supabase-js@2";
import { appDeepLink, escapeHtml, sendTelegramMessage } from "../_shared/telegramNotify.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN")!;
const BOT_USERNAME = Deno.env.get("BOT_USERNAME") ?? "";
const APP_SHORT_NAME = Deno.env.get("APP_SHORT_NAME") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("UNAUTHORIZED", { status: 401 });
  }

  // ---- пуш №2: дуэль 3+ часа висит без гостя ----
  const { data: duelReminders, error: duelErr } = await supabase.rpc(
    "get_duel_reminders",
    { p_limit: 50 },
  );
  if (duelErr) console.error("get_duel_reminders failed", duelErr);

  for (const r of duelReminders ?? []) {
    await sendTelegramMessage(
      BOT_TOKEN,
      r.tg_id,
      "⏳ Никто пока не принял твой вызов на дуэль. Пригласи ещё раз — вопросы те же ждут соперника.",
      { text: "Пригласить друга", url: appDeepLink(BOT_USERNAME, APP_SHORT_NAME, `duel_${r.duel_id}`) },
    ).catch(() => {});
  }

  // ---- пуш №3: не заходил 24+ часа ----
  const { data: inactiveReminders, error: inactiveErr } = await supabase.rpc(
    "get_inactivity_reminders",
    { p_limit: 50 },
  );
  if (inactiveErr) console.error("get_inactivity_reminders failed", inactiveErr);

  for (const r of inactiveReminders ?? []) {
    const name = r.first_name ? `${escapeHtml(r.first_name)}, ` : "";
    await sendTelegramMessage(
      BOT_TOKEN,
      r.tg_id,
      `🧠 ${name}новые дуэли и вопросы уже ждут. Загляни на разок!`,
      { text: "Открыть викторину", url: appDeepLink(BOT_USERNAME, APP_SHORT_NAME) },
    ).catch(() => {});
  }

  return new Response(
    JSON.stringify({
      duel_reminders: duelReminders?.length ?? 0,
      inactivity_reminders: inactiveReminders?.length ?? 0,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
