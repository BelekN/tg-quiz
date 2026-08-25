-- ============================================================
-- Аудит безопасности перед публичным релизом. Проверено вживую через
-- прямой REST-запрос к Supabase с anon-ключом (минуя tg-api):
--
--   * Все RPC (upsert_user, start_duel, answer_question, ...) отдают
--     401 permission denied — Supabase по умолчанию не даёт anon
--     EXECUTE на функции в public. Явные revoke/grant в миграциях —
--     подстраховка, а не единственный барьер.
--   * users/questions/duels/duel_answers/... отдают 401 (явный
--     revoke на таблицу, см. 020_fixes.sql) — тоже ок.
--   * НО bug_reports, daily_sessions, daily_answers,
--     marathon_sessions, marathon_answers отдавали 200 [] (не 401):
--     RLS включён без политик, поэтому реального доступа к данным
--     нет (SELECT возвращает 0 строк, INSERT ловит "new row violates
--     row-level security policy" — тоже проверено вживую), но для
--     них не было явного revoke на уровне таблицы, в отличие от
--     остальных. Это не была рабочая дырка, но если на такую таблицу
--     когда-нибудь по ошибке добавят permissive-политику, отсутствие
--     этого revoke уберёт последний рубеж защиты. Добавляем явно —
--     для консистентности с остальными таблицами.
-- ============================================================

revoke all on table public.bug_reports        from public, anon, authenticated;
revoke all on table public.daily_sessions     from public, anon, authenticated;
revoke all on table public.daily_answers      from public, anon, authenticated;
revoke all on table public.marathon_sessions  from public, anon, authenticated;
revoke all on table public.marathon_answers   from public, anon, authenticated;

-- ------------------------------------------------------------
-- report_issue — переиздана:
--   1. p_context сверх ~4000 символов молча обрезается вместо того,
--      чтобы копиться в базе и раздувать пуш в Telegram — раньше
--      размер вообще не проверялся (ограничение было только на
--      p_message).
--   2. добавлен ГЛОБАЛЬНЫЙ дневной лимит живых пушей в SUPPORT_TG_ID
--      (200/сутки, по всем пользователям вместе): лимит 5/час был
--      per-tg_id — при открытой для всех аудитории много разных
--      аккаунтов всё равно могли бы затопить личный чат разработчика.
--      Отчёт всё равно сохраняется в bug_reports всегда — теряется
--      только мгновенный пуш, не сами данные.
-- ------------------------------------------------------------
create or replace function public.report_issue(
  p_tg_id    bigint,
  p_message  text,
  p_context  jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message      text := trim(p_message);
  v_context      jsonb := p_context;
  v_id           uuid;
  v_recent       integer;
  v_daily_total  integer;
begin
  if length(v_message) = 0 then
    raise exception 'EMPTY_MESSAGE';
  end if;
  if length(v_message) > 2000 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;

  if v_context is not null and length(v_context::text) > 4000 then
    v_context := jsonb_build_object('truncated', true);
  end if;

  select count(*) into v_recent
    from public.bug_reports
   where tg_id = p_tg_id
     and created_at > now() - interval '1 hour';

  if v_recent >= 5 then
    raise exception 'RATE_LIMITED';
  end if;

  select count(*) into v_daily_total
    from public.bug_reports
   where created_at > now() - interval '24 hours';

  insert into public.bug_reports (tg_id, message, context)
  values (p_tg_id, v_message, v_context)
  returning id into v_id;

  -- +1 учитывает ЭТУ вставку — если она 201-я за сутки и позже,
  -- живой пуш не шлём, но строка в bug_reports остаётся навсегда.
  return jsonb_build_object('id', v_id, 'notify', (v_daily_total + 1) <= 200);
end $$;

revoke all on function public.report_issue(bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.report_issue(bigint, text, jsonb) to service_role;
