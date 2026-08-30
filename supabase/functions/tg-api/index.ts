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
import { COIN_PACKS, findCoinPack } from "../_shared/coinPacks.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN")!;
const BOT_USERNAME = Deno.env.get("BOT_USERNAME") ?? "";
const APP_SHORT_NAME = Deno.env.get("APP_SHORT_NAME") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "";
// Куда форвардить "Сообщить о проблеме" сообщением от бота — личный
// chat_id разработчика. Необязательный: без него отчёты всё равно
// сохраняются в bug_reports, просто без мгновенного пуша.
const SUPPORT_TG_ID = Deno.env.get("SUPPORT_TG_ID") ?? "";
// Принудительное обновление фронта: если задан и клиент шлёт версию
// ниже этой, "me" отвечает force_update: true — клиент показывает
// блокирующий экран вместо приложения (см. ForceUpdateScreen.jsx).
// Не задан по умолчанию — тогда force_update всегда false, старое
// поведение без изменений.
const MIN_APP_VERSION = Deno.env.get("MIN_APP_VERSION") ?? "";

// Плоское сравнение строк здесь солгало бы: "1.10.0" < "1.2.0"
// лексикографически (первый различающийся символ "1" < "2"), хотя
// по семверу 1.10.0 новее. Сравниваем числовые компоненты по одному.
function isVersionBelow(current: string, min: string): boolean {
  const c = String(current).split(".").map((n) => parseInt(n, 10) || 0);
  const m = String(min).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(c.length, m.length); i++) {
    const cv = c[i] ?? 0;
    const mv = m[i] ?? 0;
    if (cv !== mv) return cv < mv;
  }
  return false;
}
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
  "challenge_duel",
  "accept_duel_challenge",
  "start_solo",
  "finish_solo",
  "start_sprint",
  "finish_sprint",
  "start_persona",
  "finish_persona",
  "start_compat",
  "start_daily",
  "finish_daily",
  "start_marathon",
  "finish_marathon",
  "report_issue",
  "leaderboard",
  "history",
  "set_city",
  "set_avatar",
  "buy_cosmetic",
  "create_stars_invoice",
  "buy_persona_category",
  "buy_numerology_test",
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

// Настройки уведомлений — отдельные тумблеры на "вызовы" (кто-то
// вызвал/принял вызов) и "результаты" (соперник/партнёр доиграл), не
// один общий reminders_enabled (тот — только про ретеншн-напоминания
// из tg-cron). Сверяемся с настройками ПОЛУЧАТЕЛЯ перед каждым таким
// пушем; транзиентная ошибка тут не должна тихо гасить пуш — лучше
// один лишний, чем ни одного.
async function shouldNotify(recipientTgId: number, kind: "challenge" | "result"): Promise<boolean> {
  const { data, error } = await supabase.rpc("get_notification_prefs", { p_tg_id: recipientTgId });
  if (error) {
    console.error("get_notification_prefs failed", error.message);
    return true;
  }
  return kind === "challenge" ? data.challenge_notifications_enabled : data.result_notifications_enabled;
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
        const out: Record<string, unknown> = {
          user: data,
          start_param: tg.startParam,
          force_update: Boolean(MIN_APP_VERSION) &&
            isVersionBelow(String(payload.app_version ?? "0.0.0"), MIN_APP_VERSION),
        };
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
        if (notify && await shouldNotify(notify.tg_id, "result")) {
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

        if (rivalId && await shouldNotify(rivalId, "challenge")) {
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

      // ---- вызвать конкретного игрока (из рейтинга или по нику/ID):
      // та же start_duel, просто с известной целью — хост играет
      // сразу, как при обычном "Создать дуэль", цель увидит вызов во
      // входящих (см. "duel_challenges") + получит пуш ----
      case "challenge_duel": {
        const targetTgId = Number(payload.target_tg_id);
        if (!Number.isInteger(targetTgId)) return json({ error: "INVALID_TARGET" }, 400);

        const { data, error } = await supabase.rpc("start_duel", {
          p_tg_id: tgId,
          p_questions_count: 5,
          p_target_tg_id: targetTgId,
        });
        if (error) throw error;

        if (await shouldNotify(targetTgId, "challenge")) {
          await sendTelegramMessage(
            BOT_TOKEN,
            targetTgId,
            `⚔️ ${escapeHtml(tg.user.first_name ?? "Игрок")} вызывает тебя на дуэль в КвизДуэль!`,
            { text: "Играть", url: APP_URL, webApp: true },
          ).catch(() => {});
        }

        return json(data);
      }

      // ---- входящие вызовы: кто вызвал именно меня и ждёт ответа ----
      case "duel_challenges": {
        const { data, error } = await supabase.rpc("get_duel_challenges", { p_tg_id: tgId });
        if (error) throw error;
        return json({ items: data });
      }

      // ---- исходящие вызовы: кого вызвал я сам, кто ответил и чем
      // закончилось (счёт — только когда status='completed') ----
      case "sent_duel_challenges": {
        const { data, error } = await supabase.rpc("get_sent_duel_challenges", { p_tg_id: tgId });
        if (error) throw error;
        return json({ items: data });
      }

      // ---- принять вызов: становлюсь гостем + сразу получаю вопросы,
      // как при обычном переходе по ссылке-приглашению ----
      case "accept_duel_challenge": {
        const { data: accepted, error: acceptError } = await supabase.rpc("accept_duel_challenge", {
          p_tg_id: tgId,
          p_duel_id: payload.duel_id,
        });
        if (acceptError) throw acceptError;

        const { data, error } = await supabase.rpc("start_duel", {
          p_tg_id: tgId,
          p_duel_id: payload.duel_id,
        });
        if (error) throw error;

        if (await shouldNotify(accepted.host_tg_id, "challenge")) {
          await sendTelegramMessage(
            BOT_TOKEN,
            accepted.host_tg_id,
            `✅ ${escapeHtml(tg.user.first_name ?? "Игрок")} принял твой вызов на дуэль!`,
          ).catch(() => {});
        }

        return json(data);
      }

      // ---- отклонить вызов: тихо, без пуша хосту ----
      case "decline_duel_challenge": {
        const { error } = await supabase.rpc("decline_duel_challenge", {
          p_tg_id: tgId,
          p_duel_id: payload.duel_id,
        });
        if (error) throw error;
        return json({ ok: true });
      }

      // ---- соперники: с кем чаще всего играешь и какой счёт побед ----
      case "rivals": {
        const { data, error } = await supabase.rpc("get_rivals", { p_tg_id: tgId });
        if (error) throw error;
        return json({ items: data });
      }

      // ---- профиль другого игрока: публичная статистика + разблокированные
      // достижения + личный счёт с текущим пользователем ----
      case "player_profile": {
        const targetTgId = Number(payload.tg_id);
        if (!Number.isInteger(targetTgId)) return json({ error: "INVALID_TARGET" }, 400);
        const { data, error } = await supabase.rpc("get_player_profile", {
          p_tg_id: targetTgId,
          p_viewer_tg_id: tgId,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- рейтинг среди тех, с кем реально играл (не весь глобальный топ) ----
      case "circle_leaderboard": {
        const { data, error } = await supabase.rpc("get_circle_leaderboard", { p_tg_id: tgId });
        if (error) throw error;
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

      // ---- Настройки: включить/отключить retention-напоминания ----
      case "set_reminders_enabled": {
        const { data, error } = await supabase.rpc("set_reminders_enabled", {
          p_tg_id: tgId,
          p_enabled: payload.enabled === true,
        });
        if (error) throw error;
        return json({ user: data });
      }

      case "set_challenge_notifications_enabled": {
        const { data, error } = await supabase.rpc("set_challenge_notifications_enabled", {
          p_tg_id: tgId,
          p_enabled: payload.enabled === true,
        });
        if (error) throw error;
        return json({ user: data });
      }

      case "set_result_notifications_enabled": {
        const { data, error } = await supabase.rpc("set_result_notifications_enabled", {
          p_tg_id: tgId,
          p_enabled: payload.enabled === true,
        });
        if (error) throw error;
        return json({ user: data });
      }

      // ---- магазин: каталог косметики + доступные пачки монет ----
      case "shop_catalog": {
        const { data, error } = await supabase.rpc("get_shop_cosmetics", { p_tg_id: tgId });
        if (error) throw error;
        return json({
          cosmetics: data,
          coin_packs: COIN_PACKS.map(({ key, title, stars, coins }) => ({ key, title, stars, coins })),
        });
      }

      // ---- купить косметику за монеты ----
      case "buy_cosmetic": {
        const { data, error } = await supabase.rpc("buy_cosmetic", {
          p_tg_id: tgId,
          p_item_key: payload.item_key,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- надеть/снять (null) купленную рамку ----
      case "equip_frame": {
        const { data, error } = await supabase.rpc("equip_frame", {
          p_tg_id: tgId,
          p_item_key: payload.item_key ?? null,
        });
        if (error) throw error;
        return json({ user: data });
      }

      // ---- надеть/снять (null) купленный титул у имени ----
      case "equip_badge": {
        const { data, error } = await supabase.rpc("equip_badge", {
          p_tg_id: tgId,
          p_item_key: payload.item_key ?? null,
        });
        if (error) throw error;
        return json({ user: data });
      }

      // ---- создать инвойс на пачку монет за Stars: клиент открывает
      // ссылку через invoice.open(url, 'url') из @telegram-apps/sdk.
      // Цену берём ТОЛЬКО из COIN_PACKS по ключу — payload.stars от
      // клиента, если бы он был, никогда не использовался бы напрямую. ----
      case "create_stars_invoice": {
        const pack = findCoinPack(String(payload.pack_key ?? ""));
        if (!pack) return json({ error: "UNKNOWN_PACK" }, 400);

        let res: Response;
        try {
          res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: `КвизДуэль — ${pack.title}`,
              description: "Пополнение баланса монет в КвизДуэль",
              payload: pack.key,
              currency: "XTR",
              prices: [{ label: pack.title, amount: pack.stars }],
            }),
          });
        } catch {
          // fetch() сам может бросить (обрыв сети/DNS) с Error, чей
          // .message часто включает полный URL запроса — а в нём
          // BOT_TOKEN. Ловим здесь же и логируем без деталей ошибки,
          // чтобы токен не утёк в логи (см. telegramNotify.ts).
          console.error("createInvoiceLink network error");
          return json({ error: "INVOICE_FAILED" }, 500);
        }
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) {
          console.error("createInvoiceLink failed", JSON.stringify(body));
          return json({ error: "INVOICE_FAILED" }, 500);
        }
        return json({ invoice_url: body.result });
      }

      // ---- сообщить о проблеме: сохраняем + best-effort пуш в SUPPORT_TG_ID ----
      case "report_issue": {
        const { data, error } = await supabase.rpc("report_issue", {
          p_tg_id: tgId,
          p_message: payload.message,
          p_context: payload.context ?? null,
        });
        if (error) throw error;

        // notify=false раз в сутки набегает 200+ отчётов по ВСЕМ
        // пользователям — строка всё равно сохранена в bug_reports,
        // просто живой пуш пропускаем, чтобы личку не затопило при
        // открытой для всех аудитории (см. лимит в самой RPC).
        const notify = data.notify;
        delete data.notify;

        if (SUPPORT_TG_ID && notify) {
          const who = escapeHtml(tg.user.username ? `@${tg.user.username}` : tg.user.first_name ?? String(tgId));
          const contextLine = payload.context
            ? `\n<code>${escapeHtml(JSON.stringify(payload.context)).slice(0, 3000)}</code>`
            : "";
          // Крэши рендера (ErrorBoundary) шлют сюда же, но с
          // context.kind === "crash" — помечаем иначе, чтобы сразу
          // отличать от ручных отчётов пользователей.
          const isCrash = (payload.context as Record<string, unknown> | null)?.kind === "crash";
          const label = isCrash ? "💥 Крэш" : "🐞 Отчёт";
          await sendTelegramMessage(
            BOT_TOKEN,
            Number(SUPPORT_TG_ID),
            `${label} от ${who} (${tgId}):\n\n${escapeHtml(String(payload.message)).slice(0, 3000)}${contextLine}`,
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
          p_difficulty: payload.difficulty ?? null,
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
        const { data, error } = await supabase.rpc("get_persona_tests", { p_tg_id: tgId });
        if (error) throw error;
        return json({ items: data });
      }

      // ---- купить платный раздел "Узнай себя" целиком ----
      case "buy_persona_category": {
        const { data, error } = await supabase.rpc("buy_persona_category", {
          p_tg_id: tgId,
          p_category: payload.category,
        });
        if (error) throw error;
        return json(data);
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

      // ---- совместимость: каталог тестов ----
      case "compat_tests": {
        const { data, error } = await supabase.rpc("get_compat_tests");
        if (error) throw error;
        return json({ items: data });
      }

      // ---- совместимость: p_test_key -> хост создаёт, p_session_id -> присоединение/резюме ----
      case "start_compat": {
        const { data, error } = await supabase.rpc("start_compat", {
          p_tg_id: tgId,
          p_test_key: payload.test_key ?? null,
          p_session_id: payload.session_id ?? null,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- совместимость: ответ на вопрос ----
      case "answer_compat": {
        const { data, error } = await supabase.rpc("answer_compat", {
          p_tg_id: tgId,
          p_session_id: payload.session_id,
          p_question_id: payload.question_id,
          p_option_index: payload.option_index,
        });
        if (error) throw error;

        // Пуш второму участнику: без этого его результат было некому
        // сообщить — партнёр почти всегда сворачивает мини-апп сразу
        // после отправки инвайта (чтобы дотянуться до чата), поллинг
        // останавливается вместе с JS, и без пуша итог терялся
        // безвозвратно. startapp=compat_<id> ведёт назад в ЭТУ сессию —
        // start_compat теперь резюмирует её сразу на экране результата.
        const notify = data.notify;
        delete data.notify;
        if (notify && await shouldNotify(notify.tg_id, "result")) {
          await sendTelegramMessage(
            BOT_TOKEN,
            notify.tg_id,
            `💞 Партнёр прошёл тест на совместимость с тобой — ${notify.match_percent}% совпадения!`,
            {
              text: "Посмотреть результат",
              url: appDeepLink(BOT_USERNAME, APP_SHORT_NAME, `compat_${payload.session_id}`),
            },
          ).catch(() => {});
        }

        return json(data);
      }

      // ---- совместимость: поллинг для того, кто ждёт партнёра ----
      case "compat_progress": {
        const { data, error } = await supabase.rpc("get_compat_progress", {
          p_tg_id: tgId,
          p_session_id: payload.session_id,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- совместимость: разбивка по вопросам (только для завершённой сессии) ----
      case "compat_detail": {
        const { data, error } = await supabase.rpc("get_compat_detail", {
          p_tg_id: tgId,
          p_session_id: payload.session_id,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- нумерология: каталог ----
      case "numerology_tests": {
        const { data, error } = await supabase.rpc("get_numerology_tests", { p_tg_id: tgId });
        if (error) throw error;
        return json({ items: data });
      }

      // ---- нумерология: купить один тест (не пакетом) ----
      case "buy_numerology_test": {
        const { data, error } = await supabase.rpc("buy_numerology_test", {
          p_tg_id: tgId,
          p_test_key: payload.test_key,
        });
        if (error) throw error;
        return json(data);
      }

      // ---- нумерология: посчитать по дате рождения, без сохранения ----
      case "compute_numerology": {
        const { data, error } = await supabase.rpc("compute_numerology", {
          p_tg_id: tgId,
          p_test_key: payload.test_key,
          p_day: payload.day,
          p_month: payload.month,
          p_year: payload.year,
        });
        if (error) throw error;
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
