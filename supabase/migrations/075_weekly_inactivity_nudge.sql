-- ============================================================
-- Инактивити-пуш (напоминание вернуться в игру) слал уведомление
-- каждые 24 часа неактивности — пользователи жаловались, что бот
-- пишет буквально каждый день. Разводим паузу до раза в неделю:
-- порог "давно не заходил" и cooldown last_nudge_at — оба 7 дней
-- вместо 24 часов.
--
-- "Умный час" (018_smart_timing.sql) — ждём привычный час пользователя,
-- но не бесконечно: если неактивен значительно дольше базового порога,
-- шлём в любой тик крона, не дожидаясь подходящего часа. Раньше это
-- было "24ч база / 48ч отказ от подбора часа" (буфер = 1 база). При
-- недельной базе держим тот же буфер: 7 дней база / 8 дней отказ.
-- ============================================================

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
     where u.updated_at < now() - interval '7 days'
       and u.reminders_enabled
       and (u.last_nudge_at is null or u.last_nudge_at < now() - interval '7 days')
       and (
         p.pref_hour is null
         or u.updated_at < now() - interval '8 days'
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

revoke all on function public.get_inactivity_reminders(integer) from public, anon, authenticated;
grant execute on function public.get_inactivity_reminders(integer) to service_role;
