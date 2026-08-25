-- ============================================================
-- Настройки пользователя, часть 1: отключаемые напоминания +
-- лимит на "Сообщить о проблеме" (см. также src/screens/SettingsScreen.jsx).
--
-- Раньше единственный способ не получать retention-пуши (напоминание
-- про висящую дуэль / неактивность) — заблокировать бота целиком,
-- что рвёт и транзакционные уведомления (итог дуэли, реванш). Здесь —
-- отдельный флаг именно для напоминаний.
-- ============================================================

alter table public.users add column if not exists reminders_enabled boolean not null default true;

-- ------------------------------------------------------------
-- set_reminders_enabled — переключатель в Настройках
-- ------------------------------------------------------------
create or replace function public.set_reminders_enabled(
  p_tg_id   bigint,
  p_enabled boolean
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
begin
  update public.users
     set reminders_enabled = p_enabled, updated_at = now()
   where tg_id = p_tg_id
  returning * into v_user;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  return v_user;
end $$;

revoke all on function public.set_reminders_enabled(bigint, boolean) from public, anon, authenticated;
grant execute on function public.set_reminders_enabled(bigint, boolean) to service_role;

-- ------------------------------------------------------------
-- get_duel_reminders / get_inactivity_reminders — переизданы с
-- учётом reminders_enabled. Пуш об итоге ЭТОЙ дуэли (finish_duel) и
-- реванше (rematch_duel) сюда не относится — это транзакционные
-- уведомления о том, что уже произошло, не напоминания.
-- ------------------------------------------------------------
create or replace function public.get_duel_reminders(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  with candidates as (
    select d.id, d.host_tg_id
      from public.duels d
      join public.users u on u.tg_id = d.host_tg_id
     where d.status = 'pending'
       and d.guest_tg_id is null
       and d.reminded_at is null
       and d.created_at < now() - interval '3 hours'
       and u.reminders_enabled
     order by d.created_at
     limit p_limit
     for update of d skip locked
  ),
  marked as (
    update public.duels d
       set reminded_at = now()
      from candidates c
     where d.id = c.id
    returning d.id, d.host_tg_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('tg_id', host_tg_id, 'duel_id', id)), '[]'::jsonb)
    into v_result
    from marked;

  return v_result;
end $$;

create or replace function public.get_inactivity_reminders(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_now_hour integer := extract(hour from now())::int;
begin
  with prefs as (
    select tg_id, mode() within group (order by extract(hour from created_at)::int) as pref_hour
      from public.events
     where name = 'me'
     group by tg_id
  ),
  candidates as (
    select u.tg_id, u.first_name
      from public.users u
      left join prefs p on p.tg_id = u.tg_id
     where u.updated_at < now() - interval '24 hours'
       and u.reminders_enabled
       and (u.last_nudge_at is null or u.last_nudge_at < now() - interval '24 hours')
       and (
         p.pref_hour is null
         or u.updated_at < now() - interval '48 hours'
         or abs(v_now_hour - p.pref_hour) <= 1
         or abs(v_now_hour - p.pref_hour) >= 23  -- переход через полночь (23 <-> 0)
       )
     order by u.updated_at
     limit p_limit
     for update skip locked
  ),
  marked as (
    update public.users u
       set last_nudge_at = now()
      from candidates c
     where u.tg_id = c.tg_id
    returning u.tg_id, u.first_name
  )
  select coalesce(jsonb_agg(jsonb_build_object('tg_id', tg_id, 'first_name', first_name)), '[]'::jsonb)
    into v_result
    from marked;

  return v_result;
end $$;

-- ------------------------------------------------------------
-- report_issue — переиздана с лимитом: не больше 5 отчётов в час на
-- пользователя. Раньше аудитория была "друзья", можно было не думать
-- про спам; теперь приложение открыто для всех, и незалимиченный canal
-- прямого пуша в личку разработчику — очевидная дыра.
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
  v_message text := trim(p_message);
  v_id      uuid;
  v_recent  integer;
begin
  if length(v_message) = 0 then
    raise exception 'EMPTY_MESSAGE';
  end if;
  if length(v_message) > 2000 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;

  select count(*) into v_recent
    from public.bug_reports
   where tg_id = p_tg_id
     and created_at > now() - interval '1 hour';

  if v_recent >= 5 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.bug_reports (tg_id, message, context)
  values (p_tg_id, v_message, p_context)
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end $$;

revoke all on function public.report_issue(bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.report_issue(bigint, text, jsonb) to service_role;
