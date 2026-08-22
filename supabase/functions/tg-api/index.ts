// Единственная точка входа для клиента.
// Клиент НЕ обращается к таблицам напрямую (RLS всё запрещает),
// поэтому очки и монеты подделать нельзя.
//
// Деплой:
//   supabase functions deploy tg-api --no-verify-jwt
//   supabase secrets set BOT_TOKEN=123456:AA...
//
// --no-verify-jwt обязателен: авторизация тут своя, по initData.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyInitData } from "./initData.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN")!;
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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

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

  const { action, payload = {} } = await req.json().catch(() => ({}));
  const tgId = tg.user.id;

  try {
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
        return json({ user: data, start_param: tg.startParam });
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
        return json(data);
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

      // ---- сохранить город (вводится один раз вручную) ----
      case "set_city": {
        const { data, error } = await supabase.rpc("set_city", {
          p_tg_id: tgId,
          p_city: payload.city ?? null,
        });
        if (error) throw error;
        return json({ user: data });
      }

      default:
        return json({ error: "UNKNOWN_ACTION" }, 400);
    }
  } catch (e) {
    const message = (e as { message?: string }).message ?? "SERVER_ERROR";
    // бизнес-ошибки из RPC (DUEL_NOT_FOUND и т.п.) — это 400, не 500
    const isBusiness = /^[A-Z_]+$/.test(message);
    return json({ error: message }, isBusiness ? 400 : 500);
  }
});
