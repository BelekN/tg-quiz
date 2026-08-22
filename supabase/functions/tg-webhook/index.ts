// Обработчик входящих апдейтов бота (Telegram Bot API webhook).
// Без него нативная кнопка "START" в чате с ботом уходит в никуда:
// Telegram шлёт нам /start, а ответить некому. Заодно тут же живут
// остальные команды бота (/play, /rating, /help).
//
// Деплой и подключение:
//   supabase functions deploy tg-webhook --no-verify-jwt
//   supabase secrets set WEBHOOK_SECRET=...
//   curl "https://<project>.supabase.co/functions/v1/tg-webhook?setup=<WEBHOOK_SECRET>"
//   (сам зарегистрирует вебхук и меню команд — см. GET-ветку ниже)

import { createClient } from "jsr:@supabase/supabase-js@2";
import { appDeepLink, escapeHtml, sendTelegramMessage } from "../_shared/telegramNotify.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN")!;
const BOT_USERNAME = Deno.env.get("BOT_USERNAME") ?? "";
const APP_SHORT_NAME = Deno.env.get("APP_SHORT_NAME") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const COMMANDS = [
  { command: "start", description: "Начать / открыть викторину" },
  { command: "play", description: "Открыть приложение" },
  { command: "rating", description: "Топ игроков и твоё место" },
  { command: "help", description: "Что умеет бот" },
];

const HELP_TEXT =
  "🧠 <b>TG Quiz</b> — викторина прямо в Telegram.\n\n" +
  "⚔️ Дуэль — вызови друга, 5 вопросов на скорость\n" +
  "🧩 Квиз-тесты — тематические подборки без таймера\n" +
  "⚡ Спринт — максимум верных ответов за 60 секунд\n\n" +
  "Команды:\n" +
  "/play — открыть приложение\n" +
  "/rating — топ игроков и твоё место\n" +
  "/help — это сообщение";

function openAppButton(startParam?: string) {
  return { text: "🎮 Играть", url: appDeepLink(BOT_USERNAME, APP_SHORT_NAME, startParam) };
}

async function sendRating(chatId: number, tgId: number) {
  const { data, error } = await supabase.rpc("get_leaderboard", { p_tg_id: tgId, p_limit: 5 });
  if (error) {
    console.error("get_leaderboard failed", error);
    await sendTelegramMessage(BOT_TOKEN, chatId, "Не получилось загрузить рейтинг, попробуй чуть позже.");
    return;
  }

  const top = (data?.top ?? []) as Array<Record<string, unknown>>;
  if (top.length === 0) {
    await sendTelegramMessage(
      BOT_TOKEN,
      chatId,
      "Пока в рейтинге пусто — сыграй первым!",
      openAppButton(),
    );
    return;
  }

  const lines = top.map((p) => {
    const rank = p.rank as number;
    const name = escapeHtml((p.first_name as string) || (p.username as string) || "Игрок");
    const mark = MEDAL[rank] ?? `${rank}.`;
    return `${mark} ${name} — ${p.total_score}`;
  });

  const me = data?.me as Record<string, unknown> | null;
  const meInTop = me && top.some((p) => p.tg_id === me.tg_id);
  if (me && !meInTop) {
    lines.push("···");
    lines.push(`${me.rank}. Ты — ${me.total_score}`);
  }

  await sendTelegramMessage(
    BOT_TOKEN,
    chatId,
    `🏆 <b>Топ игроков</b>\n\n${lines.join("\n")}`,
    openAppButton(),
  );
}

Deno.serve(async (req) => {
  // Бутстрап: сам регистрирует вебхук и меню команд в Telegram, не
  // выдавая BOT_TOKEN наружу. Дёргается вручную после деплоя/ротации.
  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("setup") === WEBHOOK_SECRET) {
    // req.url — внутренний адрес за прокси Supabase, а не публичный
    // HTTPS-хост, поэтому собираем его из SUPABASE_URL явно.
    const publicUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tg-webhook`;
    const [webhookRes, commandsRes] = await Promise.all([
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: publicUrl, secret_token: WEBHOOK_SECRET }),
      }).then((r) => r.json()),
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commands: COMMANDS }),
      }).then((r) => r.json()),
    ]);
    return new Response(JSON.stringify({ webhookRes, commandsRes }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== WEBHOOK_SECRET) {
    return new Response("UNAUTHORIZED", { status: 401 });
  }

  const update = await req.json().catch(() => null);
  const message = update?.message;
  const text: string | undefined = message?.text;
  const chatId = message?.chat?.id;
  const fromId = message?.from?.id;

  if (chatId && text?.startsWith("/")) {
    // "/start@BNQuiz_bot duel_xxx" -> команда "/start", аргумент "duel_xxx"
    const [cmdRaw, ...rest] = text.trim().split(/\s+/);
    const cmd = cmdRaw.split("@")[0];
    const payload = rest.join(" ") || undefined;

    try {
      switch (cmd) {
        case "/start": {
          const name = message?.from?.first_name ? `, ${escapeHtml(message.from.first_name)}` : "";
          await sendTelegramMessage(
            BOT_TOKEN,
            chatId,
            `👋 Привет${name}! Это викторина для дуэлей с друзьями и одиночной игры.\n\nЖми «Играть», чтобы открыть приложение.`,
            openAppButton(payload),
          );
          break;
        }

        case "/play":
          await sendTelegramMessage(BOT_TOKEN, chatId, "Открываю викторину 👇", openAppButton(payload));
          break;

        case "/rating":
          if (fromId) await sendRating(chatId, fromId);
          break;

        case "/help":
          await sendTelegramMessage(BOT_TOKEN, chatId, HELP_TEXT, openAppButton());
          break;

        default:
          await sendTelegramMessage(BOT_TOKEN, chatId, "Не знаю такой команды. Наберите /help.");
      }
    } catch (e) {
      console.error("command handling failed", cmd, e);
    }
  }

  // Telegram ждёт 200 в любом случае, иначе будет повторять апдейт.
  return new Response("ok");
});
