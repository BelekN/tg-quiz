// Единственная точка входа для клиента.
// Клиент НЕ обращается к таблицам напрямую (RLS всё запрещает),
// поэтому очки и монеты подделать нельзя.
//
// Деплой:
//   supabase functions deploy tg-api --no-verify-jwt
//   supabase secrets set BOT_TOKEN=123456:AA...
//
// --no-verify-jwt обязателен: авторизация тут своя, по initData.

// Версия закреплена явно: без пина `@2` резолвится к любой 2.x на
// момент деплоя — так и вылезла регрессия, где .rpc(...) вернул
// нечто без .catch() (см. фикс в теле функции ниже).
import { createClient } from "jsr:@supabase/supabase-js@2.112.3";
import { verifyInitData } from "./initData.ts";
import {
  appDeepLink,
  escapeHtml,
  sendTelegramMessage,
} from "../_shared/telegramNotify.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN")!;
const BOT_USERNAME = Deno.env.get("BOT_USERNAME") ?? "";
const APP_SHORT_NAME = Deno.env.get("APP_SHORT_NAME") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "";
// Куда форвардить "Сообщить о проблеме" сообщением от бота — личный
// chat_id разработчика. Необязательный: без него отчёты всё равно
// сохраняются в bug_reports, просто без мгновенного пуша.
const SUPPORT_TG_ID = Deno.env.get("SUPPORT_TG_ID") ?? "";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FUNNEL_ACTIONS = new Set([
  "me",
  "start_duel",
  "finish_duel",
  "rematch_duel",
  "start_solo",
  "finish_solo",
  "start_sprint",
  "finish_sprint",
  "start_persona",
  "finish_persona",
  "start_daily",
  "finish_daily",
  "start_marathon",
  "finish_marathon",
  "report_issue",
  "leaderboard",
  "history",
  "set_city",
  "set_avatar",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// Пересчитывает достижения после игры и вешает на ответ новые (для
// тоста на клиенте). Сбой пересчёта не должен ронять сам финиш игры —
// в худшем случае просто не покажем тост в этот раз.
async function attachNewAchievements(tgId: number, data: Record<string, unknown>) {
  const { data: newly, error } = await supabase.rpc("check_achievements", { p_tg_id: tgId });
  if (error) {
    console.error("check_achievements failed", error.message);
    data.new_achievements = [];
  } else {
    data.new_achievements = newly ?? [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  // Authorization: tma <initDataRaw>
  // ВАЖНО: split(" ") резал бы initData на куски по КАЖДОМУ пробелу
  // (первый попавшийся пробел в значении любого поля обрезал бы
  // всё, что после), поэтому делим только по первому пробелу.
  const auth = req.headers.get("Authorization") ?? "";
  const sep = auth.indexOf(" ");
  const scheme = sep === -1 ? auth : auth.slice(0, sep);
  const raw = sep === -1 ? "" : auth.slice(sep + 1);
  if (scheme !== "tma" || !raw) return json({ error: "UNAUTHORIZED" }, 401);

  let tg;
  try {
    tg = await verifyInitData(raw, BOT_TOKEN);
  } catch (e) {
    return json({ error: String((e as Error).message) }, 401);
  }

  // ВАЖНО: всё, что ниже (до конца функции), обёрнуто в один try —
  // до фикса check_rate_limit/req.json() выполнялись СНАРУЖИ try, и
  // необработанное исключение там (напр. RPC-промис, который
  // supabase-js в редких случаях реджектит, а не резолвит с
  // {error}) улетало мимо json()-хелпера, а значит без CORS-заголовков.
  // Браузер в таком случае видит не тело ошибки, а fetch()-реджект
  // ("Load failed"/"Failed to fetch") — ровно то, что ловится по коду
  // NETWORK_ERROR на клиенте и выглядит как обрыв сети, хотя на самом
  // деле сервер уже ответил (просто ответом без CORS).
  let action: string | undefined;
  try {
    // Best-effort защита от заспамливания одним initData: 40 запросов
    // за 10 секунд с одного tg_id. Если сама проверка не выполнилась
    // (транзиентная ошибка БД) — не роняем весь API, просто пропускаем
    // запрос дальше; это не единственный рубеж защиты (очки и так
    // считает Postgres из реально записанных ответов).
    const { data: withinLimit, error: rlError } = await supabase.rpc(
      "check_rate_limit",
      { p_tg_id: tg.user.id },
    );
    if (rlError) {
      console.error("check_rate_limit failed", rlError.message);
    } else if (withinLimit === false) {
      return json({ error: "RATE_LIMITED" }, 429);
    }

    const body = await req.json().catch(() => ({}));
    action = body?.action;
    // "payload = {}" по умолчанию сработал бы только на undefined, а не
    // на явный payload: null — а такой запрос легитимному пользователю
    // собрать не стоит труда.
    const payload = body?.payload ?? {};
    const tgId = tg.user.id;

    // Воронка: логируем только "крупные" события — старт/финиш каждого
    // режима, вход, реванш, просмотр рейтинга/истории. Осознанно НЕ логируем
    // answer_question/answer_solo/answer_sprint — это происходит по разу
    // на каждый вопрос, для воронки такая частота только шум.
    //
    // "me" — отдельный случай: events.tg_id это FK на users(tg_id), а
    // для совсем нового пользователя строки в users ещё нет (её создаёт
    // upsert_user внутри case "me" ниже). Залогировать здесь — верную
    // FK-ошибку, которая тихо проглатывалась try/catch, и самое важное
    // событие воронки (первый вход) для новых пользователей никогда не
    // попадало в events. Логируем "me" отдельно, после upsert_user.
    if (FUNNEL_ACTIONS.has(action) && action !== "me") {
      // supabase-js RPC-builder — не всегда настоящий Promise (сборка не
      // закреплена лок-файлом), .catch() на нём может быть не функцией
      // вовсе — из-за этого ловили необработанное исключение мимо всех
      // try/catch и ответ без CORS-заголовков (браузер видел это как
      // сетевой сбой). try/catch вместо чейнинга работает независимо от
      // формы возвращаемого объекта.
      try {
        await supabase.rpc("log_event", { p_tg_id: tgId, p_name: action, p_payload: payload });
      } catch {
        /* воронка — best-effort, не роняем основной запрос */
      }
    }

    switch (action) {
      // ---- вход: апсертим профиль, отдаём баланс ----
      case "me": {
        const { data, error } = await supabase.rpc("upsert_user", {
          p_tg_id: tgId,
          p_username: tg.user.username ?? null,
          p_first_name: tg.user.first_name ?? null,
          p_photo_url: tg.user.photo_url ?? null,
        });
        if (error) throw error;
        try {
          await supabase.rpc("log_event", { p_tg_id: tgId, p_name: "me", p_payload: payload });
        } catch {
          /* воронка — best-effort */
        }
        // Дневные стрики (streak_7/streak_30) разблокируются только
        // логином — finish_duel/finish_solo/finish_sprint/finish_persona
        // сюда не заходят, поэтому это ЕДИНСТВЕННОЕ место, где они могут
        // разблокироваться. attachNewAchievements кладёт new_achievements
        // прямо в переданный объект — отдаём его как обычно, верхним
        // уровнем, а не внутри "user".
        const out: Record<string, unknown> = { user: data, start_param: tg.startParam };
        await attachNewAchievements(tgId, out);
        return json(out);
      }

      // ---- старт дуэли: создать или войти по ссылке ----
      case "start_duel": {
        const { data, error } = await supabase.rpc("start_duel", {
          p_tg_id: tgId,
          p_duel_id: payload.duel_id ?? null,
          p_questions_count: 5,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- ответ на вопрос: пишем выбор, возвращаем правильный ----
      case "answer_question": {
        const { data, error } = await supabase.rpc("answer_question", {
          p_tg_id: tgId,
          p_duel_id: payload.duel_id,
          p_index: payload.index,
          p_answer: payload.answer ?? null,
          p_elapsed_ms: payload.elapsed_ms,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- финиш: очки суммирует Postgres из duel_answers ----
      case "finish_duel": {
        const { data, error } = await supabase.rpc("finish_duel", {
          p_tg_id: tgId,
          p_duel_id: payload.duel_id,
        });
        if (error) throw error;

        // Пуш №1: соперник (доигравший первым) узнаёт исход сразу
        const notify = data.notify;
        delete data.notify;
        if (notify) {
          const outcomeText = {
            win: "🏆 Ты выиграл дуэль!",
            lose: "💔 Соперник обошёл тебя в дуэли",
            draw: "🤝 Ничья в дуэли",
          }[notify.outcome_for_rival as string] ?? "Дуэль завершена";

          // ждём отправки: после ответа клиенту изолят функции может
          // быть остановлен раньше, чем фоновый fetch успеет уйти
          await sendTelegramMessage(
            BOT_TOKEN,
            notify.tg_id,
            `${outcomeText}\n\n${escapeHtml(notify.finisher_name)} набрал ${notify.finisher_score}, у тебя ${notify.rival_score}.`,
            { text: "Посмотреть итог", url: APP_URL, webApp: true },
          ).catch(() => {});
        }

        await attachNewAchievements(tgId, data);
        return json(data);
      }

      // ---- реванш: новая дуэль с тем же соперником + пуш ему ----
      case "rematch_duel": {
        const { data, error } = await supabase.rpc("rematch_duel", {
          p_tg_id: tgId,
          p_duel_id: payload.duel_id,
        });
        if (error) throw error;

        const rivalId = data.rival_tg_id;
        delete data.rival_tg_id;

        if (rivalId) {
          // startapp=duel_<id> обязателен, чтобы initData.startParam
          // донёс id новой дуэли — web_app-кнопка это не умеет,
          // поэтому тут классическая t.me-ссылка, как у обычного инвайта.
          await sendTelegramMessage(
            BOT_TOKEN,
            rivalId,
            `🔁 ${escapeHtml(tg.user.first_name ?? "Соперник")} зовёт тебя на реванш!`,
            {
              text: "Принять вызов",
              url: appDeepLink(BOT_USERNAME, APP_SHORT_NAME, `duel_${data.duel_id}`),
            },
          ).catch(() => {});
        }

        return json(data);
      }

      // ---- история игр: дуэли + завершённые соло/спринт сессии ----
      case "history": {
        const { data, error } = await supabase.rpc("get_history", {
          p_tg_id: tgId,
          p_limit: 30,
        });
        if (error) throw error;
        return json({ items: data });
      }

      // ---- таблица лидеров: топ N + позиция текущего игрока ----
      case "leaderboard": {
        const { data, error } = await supabase.rpc("get_leaderboard", {
          p_tg_id: tgId,
          p_limit: 20,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- сохранить выбранную аватарку (null = вернуть фото Telegram) ----
      case "set_avatar": {
        const { data, error } = await supabase.rpc("set_avatar", {
          p_tg_id: tgId,
          p_avatar_key: payload.avatar_key ?? null,
        });
        if (error) throw error;
        return json({ user: data });
      }

      // ---- сохранить город (вводится один раз вручную) ----
      case "set_city": {
        const { data, error } = await supabase.rpc("set_city", {
          p_tg_id: tgId,
          p_city: payload.city ?? null,
        });
        if (error) throw error;
        return json({ user: data });
      }

      // ---- сообщить о проблеме: сохраняем + best-effort пуш в SUPPORT_TG_ID ----
      case "report_issue": {
        const { data, error } = await supabase.rpc("report_issue", {
          p_tg_id: tgId,
          p_message: payload.message,
          p_context: payload.context ?? null,
        });
        if (error) throw error;

        if (SUPPORT_TG_ID) {
          const who = escapeHtml(tg.user.username ? `@${tg.user.username}` : tg.user.first_name ?? String(tgId));
          const contextLine = payload.context
            ? `\n<code>${escapeHtml(JSON.stringify(payload.context))}</code>`
            : "";
          await sendTelegramMessage(
            BOT_TOKEN,
            Number(SUPPORT_TG_ID),
            `🐞 Отчёт от ${who} (${tgId}):\n\n${escapeHtml(String(payload.message))}${contextLine}`,
          ).catch(() => {});
        }

        return json(data);
      }

      // ---- список категорий соло-режима с числом вопросов ----
      case "categories": {
        const { data, error } = await supabase.rpc("get_categories");
        if (error) throw error;
        return json({ categories: data });
      }

      // ---- старт соло-сессии по категории ----
      case "start_solo": {
        const { data, error } = await supabase.rpc("start_solo", {
          p_tg_id: tgId,
          p_category: payload.category,
          p_count: 10,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- ответ в соло-режиме: пишем выбор, возвращаем правильный ----
      case "answer_solo": {
        const { data, error } = await supabase.rpc("answer_solo", {
          p_tg_id: tgId,
          p_session_id: payload.session_id,
          p_index: payload.index,
          p_answer: payload.answer ?? null,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- финиш соло-сессии: очки суммирует Postgres ----
      case "finish_solo": {
        const { data, error } = await supabase.rpc("finish_solo", {
          p_tg_id: tgId,
          p_session_id: payload.session_id,
        });
        if (error) throw error;
        await attachNewAchievements(tgId, data);
        return json(data);
      }

      // ---- старт спринта: 40 вопросов вперемешку, 60 сек на сервере ----
      case "start_sprint": {
        const { data, error } = await supabase.rpc("start_sprint", {
          p_tg_id: tgId,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- ответ в спринте: сервер сам отклонит просроченный ----
      case "answer_sprint": {
        const { data, error } = await supabase.rpc("answer_sprint", {
          p_tg_id: tgId,
          p_session_id: payload.session_id,
          p_index: payload.index,
          p_answer: payload.answer ?? null,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- финиш спринта: очки суммирует Postgres из sprint_answers ----
      case "finish_sprint": {
        const { data, error } = await supabase.rpc("finish_sprint", {
          p_tg_id: tgId,
          p_session_id: payload.session_id,
        });
        if (error) throw error;
        await attachNewAchievements(tgId, data);
        return json(data);
      }

      // ---- старт ежедневного вызова: 5 вопросов, одни на весь день ----
      case "start_daily": {
        const { data, error } = await supabase.rpc("start_daily", {
          p_tg_id: tgId,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- ответ в ежедневном вызове ----
      case "answer_daily": {
        const { data, error } = await supabase.rpc("answer_daily", {
          p_tg_id: tgId,
          p_session_id: payload.session_id,
          p_index: payload.index,
          p_answer: payload.answer ?? null,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- финиш ежедневного вызова ----
      case "finish_daily": {
        const { data, error } = await supabase.rpc("finish_daily", {
          p_tg_id: tgId,
          p_session_id: payload.session_id,
        });
        if (error) throw error;
        await attachNewAchievements(tgId, data);
        return json(data);
      }

      // ---- старт марафона: вопросы, пока не ошибёшься ----
      case "start_marathon": {
        const { data, error } = await supabase.rpc("start_marathon", {
          p_tg_id: tgId,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- ответ в марафоне ----
      case "answer_marathon": {
        const { data, error } = await supabase.rpc("answer_marathon", {
          p_tg_id: tgId,
          p_session_id: payload.session_id,
          p_index: payload.index,
          p_answer: payload.answer ?? null,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- финиш марафона: очки суммирует Postgres, отказывает,
      // если серия ещё не оборвалась и пул вопросов не исчерпан ----
      case "finish_marathon": {
        const { data, error } = await supabase.rpc("finish_marathon", {
          p_tg_id: tgId,
          p_session_id: payload.session_id,
        });
        if (error) throw error;
        await attachNewAchievements(tgId, data);
        return json(data);
      }

      // ---- "Кто ты из...": каталог тестов ----
      case "persona_tests": {
        const { data, error } = await supabase.rpc("get_persona_tests");
        if (error) throw error;
        return json({ items: data });
      }

      // ---- старт теста: вопросы целиком, без скрытых полей ----
      case "start_persona": {
        const { data, error } = await supabase.rpc("start_persona", {
          p_tg_id: tgId,
          p_test_key: payload.test_key,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- финиш: результат считает клиент, сервер только валидирует ----
      case "finish_persona": {
        const { data, error } = await supabase.rpc("finish_persona", {
          p_tg_id: tgId,
          p_session_id: payload.session_id,
          p_result_key: payload.result_key,
        });
        if (error) throw error;
        await attachNewAchievements(tgId, data);
        return json(data);
      }

      // ---- каталог достижений + что уже разблокировано ----
      case "achievements": {
        const { data, error } = await supabase.rpc("get_achievements", { p_tg_id: tgId });
        if (error) throw error;
        return json({ items: data });
      }

      // ---- прогресс соперника в текущей дуэли (поллинг вместо realtime) ----
      case "duel_progress": {
        const { data, error } = await supabase.rpc("get_duel_progress", {
          p_tg_id: tgId,
          p_duel_id: payload.duel_id,
        });
        if (error) throw error;
        return json(data);
      }

      default:
        return json({ error: "UNKNOWN_ACTION" }, 400);
    }
  } catch (e) {
    const message = (e as { message?: string }).message ?? "SERVER_ERROR";
    // бизнес-ошибки из RPC (DUEL_NOT_FOUND и т.п.) — это 400, не 500.
    // Всё остальное (PostgREST type-error text, наш собственный TypeError
    // на кривом payload и т.п.) — не бизнес-ошибка, и наружу её текст не
    // отдаём: это внутренняя деталь реализации, а не то, что должен
    // увидеть клиент. Логируем реальное сообщение только на сервере.
    const isBusiness = /^[A-Z_]+$/.test(message);
    if (!isBusiness) console.error("tg-api unhandled error", action, message);
    return json({ error: isBusiness ? message : "SERVER_ERROR" }, isBusiness ? 400 : 500);
  }
});
