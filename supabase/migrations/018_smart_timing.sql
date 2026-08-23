-- ------------------------------------------------------------
-- "Умный" тайминг инактивити-пуша: не будим людей в случайный час.
-- ------------------------------------------------------------
-- Раньше пуш уходил сразу, как только пользователь пересекал 24ч
-- неактивности — время суток получалось случайным относительно его
-- собственного ритма. Теперь берём самый частый час (UTC) из его
-- прошлых открытий приложения (событие 'me' в events) и ждём этот же
-- час, а не первый попавшийся тик крона (раз в 30 мин).
--
-- Ограничения, чтобы не превратить это в "никогда не пришлём":
--   - нет истории 'me' вообще (новый пользователь) -> шлём как раньше,
--     без задержки на "подходящий час";
--   - не заходил уже 48+ часов -> тоже не ждём час, шлём сразу —
--     иначе можно упустить пользователя, который в принципе играет
--     не каждый день.
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

revoke all on function public.get_inactivity_reminders(integer) from public, anon, authenticated;
grant execute on function public.get_inactivity_reminders(integer) to service_role;
