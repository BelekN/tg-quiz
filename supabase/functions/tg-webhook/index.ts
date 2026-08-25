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

// Версия закреплена явно — см. комментарий в tg-api/index.ts.
import { createClient } from "jsr:@supabase/supabase-js@2.112.3";
import {
  appDeepLink,
  escapeHtml,
  sendTelegramMessage,
  timingSafeEqual,
} from "../_shared/telegramNotify.ts";
import { findCoinPack } from "../_shared/coinPacks.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN")!;
const BOT_USERNAME = Deno.env.get("BOT_USERNAME") ?? "";
const APP_SHORT_NAME = Deno.env.get("APP_SHORT_NAME") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
// Тот же личный chat_id, что принимает "Сообщить о проблеме" (см.
// tg-api) — единственный, кому доступна команда /credit ниже.
const SUPPORT_TG_ID = Deno.env.get("SUPPORT_TG_ID") ?? "";
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
  "🧠 <b>КвизДуэль</b> — викторина прямо в Telegram.\n\n" +
  "⚔️ Дуэль — вызови друга, 5 вопросов на скорость\n" +
  "🧩 Квиз-тесты — тематические подборки без таймера\n" +
  "⚡ Спринт — максимум верных ответов за 60 секунд\n\n" +
  "Команды:\n" +
  "/play — открыть приложение\n" +
  "/rating — топ игроков и твоё место\n" +
  "/help — это сообщение";

// Без startParam кнопка — web_app: Telegram запускает мини-апп прямо
// и показывает "OPEN" в списке чатов у этого сообщения (как у Wallet).
// Со startParam (инвайт на дуэль из /start duel_xxx) web_app не подходит:
// он не прокидывает startParam в initData, поэтому там — классическая
// t.me-ссылка через appDeepLink.
function openAppButton(startParam?: string) {
  return startParam
    ? { text: "🎮 Играть", url: appDeepLink(BOT_USERNAME, APP_SHORT_NAME, startParam) }
    : { text: "🎮 Играть", url: APP_URL, webApp: true };
}

// Инвайт (на дуэль ИЛИ на тест совместимости) через инлайн-режим:
// пользователь жмёт "Вызвать друга"/"Позвать пройти тест", Telegram
// открывает выбор чата и присылает нам query вида "duel_<uuid>" или
// "compat_<uuid>" — отвечаем ОДНОЙ карточкой с кнопкой на приглашение.
// Без этого (через shareURL/t.me/share/url) друг видел бы сырую
// ссылку с UUID первой строкой — то, что все привыкли считать спамом.
async function answerInviteQuery(inlineQueryId: string, query: string) {
  const trimmed = query.trim();
  const duelMatch = /^duel_([0-9a-fA-F-]{36})$/.exec(trimmed);
  const compatMatch = /^compat_([0-9a-fA-F-]{36})$/.exec(trimmed);

  let text = "⚔️ Зову тебя на дуэль в КвизДуэль — 5 вопросов, кто быстрее и точнее!";
  let startParam: string | undefined;
  let title = "Пригласить на дуэль";
  let description = "5 вопросов, 10 секунд на каждый — кто быстрее и точнее";
  let resultId = "duel_invite_generic";

  if (compatMatch) {
    startParam = `compat_${compatMatch[1]}`;
    resultId = compatMatch[1];
    title = "Позвать пройти тест на совместимость";
    description = "Отвечаем по отдельности — сравним ответы и узнаем % совпадения";
    text = "💞 Пройди со мной тест на совместимость в КвизДуэль!";

    const { data: testInfo, error } = await supabase.rpc("get_compat_session_test", {
      p_session_id: compatMatch[1],
    });
    if (error) console.error("get_compat_session_test failed", error.message);
    if (testInfo?.title) {
      text = `${testInfo.icon ?? "💞"} Пройди со мной тест «${testInfo.title}» в КвизДуэль — узнаем, насколько совпадаем!`;
    }
  } else if (duelMatch) {
    startParam = `duel_${duelMatch[1]}`;
    resultId = duelMatch[1];

    const { data: score, error } = await supabase.rpc("get_duel_host_score", { p_duel_id: duelMatch[1] });
    if (error) console.error("get_duel_host_score failed", error.message);
    if (typeof score === "number") {
      text = `⚔️ Я набрал ${score} очков в дуэли КвизДуэль. Побьёшь?`;
    }
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerInlineQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inline_query_id: inlineQueryId,
        cache_time: 0,
        results: [{
          type: "article",
          id: resultId,
          title,
          description,
          input_message_content: { message_text: text },
          // url, никогда web_app: это сообщение уйдёт в чат, который
          // выберет пользователь, а web_app-кнопки Telegram разрешает
          // только в приватном чате с самим ботом.
          reply_markup: {
            inline_keyboard: [[{ text: "🎮 Играть", url: appDeepLink(BOT_USERNAME, APP_SHORT_NAME, startParam) }]],
          },
        }],
      }),
    });
    if (!res.ok) console.error("answerInlineQuery failed", await res.text().catch(() => ""));
  } catch {
    // .message от сетевой ошибки fetch() часто содержит сам запрошенный
    // URL — а в нём BOT_TOKEN. Логируем без деталей (см. telegramNotify.ts).
    console.error("answerInlineQuery network error");
  }
}

// Регистрирует вебхук + меню команд + menu button. Явно перечисляем
// allowed_updates: без этого Telegram по умолчанию должен слать все
// типы кроме chat_member/message_reaction*, но раз вебхук в проде
// оказался вообще без зарегистрированного url (см. getWebhookInfo),
// лучше не полагаться на дефолт молча.
async function registerBot(publicUrl: string) {
  try {
    return await registerBotUnsafe(publicUrl);
  } catch {
    // Как и везде здесь: .message сетевой ошибки часто включает
    // запрошенный URL, а в нём BOT_TOKEN — не даём ему попасть в лог.
    console.error("registerBot network error");
    return { error: "REGISTER_FAILED" };
  }
}

async function registerBotUnsafe(publicUrl: string) {
  const [webhookRes, commandsRes, menuButtonRes] = await Promise.all([
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: publicUrl,
        secret_token: WEBHOOK_SECRET,
        allowed_updates: ["message", "inline_query", "pre_checkout_query"],
      }),
    }).then((r) => r.json()),
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands: COMMANDS }),
    }).then((r) => r.json()),
    // Кнопка "OPEN" в списке чатов (как у Wallet) — это НЕ inline-кнопка
    // под сообщением, а глобальная настройка бота: menu button типа
    // web_app. Ставится один раз, без chat_id — как дефолт для всех.
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: { type: "web_app", text: "Играть", web_app: { url: APP_URL } },
      }),
    }).then((r) => r.json()),
  ]);
  return { webhookRes, commandsRes, menuButtonRes };
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
  const url = new URL(req.url);

  // Бутстрап: сам регистрирует вебхук и меню команд в Telegram, не
  // выдавая BOT_TOKEN наружу. Дёргается вручную после деплоя/ротации.
  // Секрет можно передать заголовком (не попадёт в access-логи/прокси,
  // в отличие от query-параметра) — ?setup= остаётся для обратной
  // совместимости с уже сохранённой curl-командой.
  const setupSecret = req.headers.get("x-setup-secret") ?? url.searchParams.get("setup") ?? "";
  if (req.method === "GET" && WEBHOOK_SECRET && timingSafeEqual(setupSecret, WEBHOOK_SECRET)) {
    // req.url — внутренний адрес за прокси Supabase, а не публичный
    // HTTPS-хост, поэтому собираем его из SUPABASE_URL явно.
    const publicUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tg-webhook`;
    return new Response(JSON.stringify(await registerBot(publicUrl)), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // WEBHOOK_SECRET пустой/не задан -> timingSafeEqual("", "") дал бы
  // true и пропустил бы кого угодно без секрета вовсе. Явно требуем
  // непустой секрет с обеих сторон (тот же принцип, что у SUPPORT_TG_ID
  // ниже в /credit).
  if (
    !WEBHOOK_SECRET ||
    !timingSafeEqual(req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "", WEBHOOK_SECRET)
  ) {
    return new Response("UNAUTHORIZED", { status: 401 });
  }

  const update = await req.json().catch(() => null);

  const inlineQuery = update?.inline_query;
  if (inlineQuery?.id) {
    try {
      await answerInviteQuery(inlineQuery.id, inlineQuery.query ?? "");
    } catch (e) {
      console.error("inline query handling failed", e);
    }
    return new Response("ok");
  }

  // Telegram ждёт ответ в течение 10 секунд — сверяем payload с
  // известной пачкой монет ДО того, как деньги реально списались.
  // Цену для сверки/начисления всегда берём из COIN_PACKS по ключу,
  // никогда из того, что прислали в самом апдейте.
  const preCheckout = update?.pre_checkout_query;
  if (preCheckout?.id) {
    const ok = Boolean(findCoinPack(preCheckout.invoice_payload ?? ""));
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          ok
            ? { pre_checkout_query_id: preCheckout.id, ok: true }
            : {
              pre_checkout_query_id: preCheckout.id,
              ok: false,
              error_message: "Этот набор монет больше недоступен, откройте магазин заново.",
            },
        ),
      });
    } catch {
      // Сетевая ошибка fetch() может нести URL с BOT_TOKEN в .message —
      // не логируем её как есть (см. тот же приём в answerInviteQuery).
      console.error("answerPreCheckoutQuery network error");
    }
    return new Response("ok");
  }

  const message = update?.message;
  const text: string | undefined = message?.text;
  const chatId = message?.chat?.id;
  const fromId: number | undefined =
    typeof message?.from?.id === "number" ? message.from.id : undefined;

  // Успешная оплата Stars — источник истины для начисления монет.
  // Клиентский invoice.open() тоже узнаёт статус "paid", но это только
  // для UX (показать "готово" побыстрее); реальное начисление —
  // только здесь, по факту реального вебхука от Telegram.
  const payment = message?.successful_payment;
  if (payment && fromId !== undefined) {
    const pack = findCoinPack(payment.invoice_payload ?? "");
    if (!pack) {
      console.error("successful_payment: unknown pack", payment.invoice_payload);
    } else if (payment.total_amount !== pack.stars) {
      // Реальная сумма списания не совпала с ценой пачки по её ключу —
      // не начисляем молча, это либо баг в создании инвойса, либо
      // подмена. Монеты не летят, деньги не трогаем — разбираемся вручную.
      console.error(
        "successful_payment: amount mismatch",
        payment.invoice_payload,
        payment.total_amount,
        pack.stars,
      );
    } else {
      try {
        const { error } = await supabase.rpc("credit_star_purchase", {
          p_tg_id: fromId,
          p_telegram_charge_id: payment.telegram_payment_charge_id,
          p_pack_key: pack.key,
          p_stars_amount: payment.total_amount,
          p_coins_to_credit: pack.coins,
        });
        if (error) throw error;
        await sendTelegramMessage(
          BOT_TOKEN,
          chatId,
          `✅ Начислено ${pack.coins} монет — спасибо за поддержку КвизДуэль!`,
          openAppButton(),
        );
      } catch (e) {
        console.error("credit_star_purchase failed", e);
      }
    }
    return new Response("ok");
  }

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
            `👋 Привет${name}! Это <b>КвизДуэль</b> — викторина для дуэлей с друзьями и одиночной игры.\n\nЖми «Играть», чтобы открыть приложение.`,
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

        // Скрытая команда: не в /help и не в setMyCommands — доступна
        // только тому, чей tg_id совпадает с SUPPORT_TG_ID. Нужна для
        // ручной правки баланса (жалоба "оплатил Stars, монеты не
        // пришли") и самопроверки без похода в SQL.
        case "/credit": {
          if (!SUPPORT_TG_ID || fromId !== Number(SUPPORT_TG_ID)) {
            await sendTelegramMessage(BOT_TOKEN, chatId, "Не знаю такой команды. Наберите /help.");
            break;
          }

          const [rawTgId, rawAmount, ...reasonParts] = (payload ?? "").split(/\s+/);
          const targetTgId = Number(rawTgId);
          const amount = Number(rawAmount);
          if (!rawTgId || !rawAmount || !Number.isInteger(targetTgId) || !Number.isInteger(amount)) {
            await sendTelegramMessage(
              BOT_TOKEN,
              chatId,
              "Формат: /credit <tg_id> <монеты> [причина]\nПример: /credit 185762393 500 stars не пришли",
            );
            break;
          }

          const { data, error } = await supabase.rpc("admin_credit_coins", {
            p_tg_id: targetTgId,
            p_amount: amount,
            p_reason: reasonParts.join(" ") || null,
          });

          if (error) {
            const notFound = error.message?.includes("USER_NOT_FOUND");
            await sendTelegramMessage(
              BOT_TOKEN,
              chatId,
              notFound
                ? `⚠️ Пользователь ${targetTgId} не найден.`
                : "⚠️ Не получилось начислить, попробуйте снова.",
            );
            break;
          }

          await sendTelegramMessage(
            BOT_TOKEN,
            chatId,
            `✅ ${amount >= 0 ? "Начислено" : "Списано"} ${Math.abs(amount)} монет пользователю ${targetTgId}.\nНовый баланс: ${data.coins}.`,
          );
          break;
        }

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
