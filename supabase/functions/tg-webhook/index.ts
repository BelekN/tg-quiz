// Обработчик входящих апдейтов бота (Telegram Bot API webhook).
// Без него нативная кнопка "START" в чате с ботом уходит в никуда:
// Telegram шлёт нам /start, а ответить некому.
//
// Деплой и подключение:
//   supabase functions deploy tg-webhook --no-verify-jwt
//   supabase secrets set WEBHOOK_SECRET=...
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
//     -d url=https://<project>.supabase.co/functions/v1/tg-webhook \
//     -d secret_token=<WEBHOOK_SECRET>

import { appDeepLink, sendTelegramMessage } from "../_shared/telegramNotify.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN")!;
const BOT_USERNAME = Deno.env.get("BOT_USERNAME") ?? "";
const APP_SHORT_NAME = Deno.env.get("APP_SHORT_NAME") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  // Бутстрап: сам регистрирует себя как вебхук в Telegram, не выдавая
  // BOT_TOKEN наружу. Дёргается вручную один раз после деплоя/ротации.
  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("setup") === WEBHOOK_SECRET) {
    // req.url — внутренний адрес за прокси Supabase, а не публичный
    // HTTPS-хост, поэтому собираем его из SUPABASE_URL явно.
    const publicUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tg-webhook`;
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: publicUrl, secret_token: WEBHOOK_SECRET }),
    });
    return new Response(await res.text(), { headers: { "Content-Type": "application/json" } });
  }

  if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== WEBHOOK_SECRET) {
    return new Response("UNAUTHORIZED", { status: 401 });
  }

  const update = await req.json().catch(() => null);
  const message = update?.message;
  const text: string | undefined = message?.text;
  const chatId = message?.chat?.id;

  // Telegram шлёт классический deep link (?start=duel_xxx) как
  // "/start duel_xxx" — вытаскиваем полезную нагрузку, если есть.
  if (chatId && text?.startsWith("/start")) {
    const payload = text.slice(6).trim() || undefined;
    const name = message?.from?.first_name ? `, ${message.from.first_name}` : "";

    await sendTelegramMessage(
      BOT_TOKEN,
      chatId,
      `👋 Привет${name}! Это викторина для дуэлей с друзьями и одиночной игры.\n\nЖми «Играть», чтобы открыть приложение.`,
      { text: "🎮 Играть", url: appDeepLink(BOT_USERNAME, APP_SHORT_NAME, payload) },
    ).catch(() => {});
  }

  // Telegram ждёт 200 в любом случае, иначе будет повторять апдейт.
  return new Response("ok");
});
