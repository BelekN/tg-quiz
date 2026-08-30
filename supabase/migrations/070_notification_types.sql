-- ============================================================
-- Разные виды пушей вместо одного общего reminders_enabled:
--   * reminders_enabled (было) — ретеншн-напоминания: висящая без
--     ответа открытая дуэль, долгое отсутствие (tg-cron).
--   * challenge_notifications_enabled (новое) — "тебя вызвали",
--     "твой вызов приняли", реванш-приглашение — социальные пуши
--     вокруг адресных вызовов на дуэль (tg-api).
--   * result_notifications_enabled (новое) — соперник доиграл дуэль,
--     партнёр прошёл тест на совместимость (tg-api).
-- Оплата Stars (tg-webhook) НИЧЕМ не гейтится и не должна — это
-- финансовая квитанция, не маркетинговый пуш.
-- ============================================================

alter table public.users
  add column challenge_notifications_enabled boolean not null default true,
  add column result_notifications_enabled    boolean not null default true;

create or replace function public.set_challenge_notifications_enabled(p_tg_id bigint, p_enabled boolean)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
begin
  update public.users
     set challenge_notifications_enabled = p_enabled, updated_at = now()
   where tg_id = p_tg_id
  returning * into v_user;

  if not found then raise exception 'USER_NOT_FOUND'; end if;
  return v_user;
end $$;

create or replace function public.set_result_notifications_enabled(p_tg_id bigint, p_enabled boolean)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
begin
  update public.users
     set result_notifications_enabled = p_enabled, updated_at = now()
   where tg_id = p_tg_id
  returning * into v_user;

  if not found then raise exception 'USER_NOT_FOUND'; end if;
  return v_user;
end $$;

-- tg-api сверяется с этим перед КАЖДЫМ соц./результатным пушем, у
-- каждого RPC своя логика уведомлений — проще один общий геттер тут,
-- чем тащить флаг через возврат каждой отдельной функции.
create or replace function public.get_notification_prefs(p_tg_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user public.users;
begin
  select * into v_user from public.users where tg_id = p_tg_id;
  if not found then
    return jsonb_build_object(
      'reminders_enabled', false,
      'challenge_notifications_enabled', false,
      'result_notifications_enabled', false
    );
  end if;

  return jsonb_build_object(
    'reminders_enabled',               v_user.reminders_enabled,
    'challenge_notifications_enabled', v_user.challenge_notifications_enabled,
    'result_notifications_enabled',    v_user.result_notifications_enabled
  );
end $$;

revoke all on function public.set_challenge_notifications_enabled(bigint, boolean) from public, anon, authenticated;
grant execute on function public.set_challenge_notifications_enabled(bigint, boolean) to service_role;
revoke all on function public.set_result_notifications_enabled(bigint, boolean) from public, anon, authenticated;
grant execute on function public.set_result_notifications_enabled(bigint, boolean) to service_role;
revoke all on function public.get_notification_prefs(bigint) from public, anon, authenticated;
grant execute on function public.get_notification_prefs(bigint) to service_role;
