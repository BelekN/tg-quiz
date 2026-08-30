-- ============================================================
-- Профиль другого игрока (публичная статистика + разблокированные
-- достижения + личный счёт с просматривающим) и рейтинг среди тех, с
-- кем реально играл (а не весь глобальный топ).
-- ============================================================

-- Публичный профиль: только то, что не стыдно показать чужому —
-- монеты сюда осознанно НЕ идут (это не рейтинг богатства), только
-- очки/стрик/косметика/достижения. vs_me — счёт именно с тем, кто
-- смотрит, если играли; games=0, если ни разу.
create or replace function public.get_player_profile(p_tg_id bigint, p_viewer_tg_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   public.users;
  v_achievements jsonb;
  v_vs_me  jsonb;
begin
  select * into v_user from public.users where tg_id = p_tg_id;
  if not found then raise exception 'USER_NOT_FOUND'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'key', a.key, 'title', a.title, 'description', a.description,
           'icon', a.icon, 'category', a.category, 'unlocked_at', ua.unlocked_at
         ) order by ua.unlocked_at desc), '[]'::jsonb)
    into v_achievements
    from public.user_achievements ua
    join public.achievements a on a.key = ua.achievement_key
   where ua.tg_id = p_tg_id;

  select jsonb_build_object(
           'games',  count(*),
           'wins',   count(*) filter (
             where (host_tg_id = p_viewer_tg_id and host_score > guest_score)
                or (guest_tg_id = p_viewer_tg_id and guest_score > host_score)
           ),
           'losses', count(*) filter (
             where (host_tg_id = p_viewer_tg_id and host_score < guest_score)
                or (guest_tg_id = p_viewer_tg_id and guest_score < host_score)
           ),
           'draws',  count(*) filter (where host_score = guest_score)
         )
    into v_vs_me
    from public.duels
   where status = 'completed' and guest_tg_id is not null
     and ((host_tg_id = p_tg_id and guest_tg_id = p_viewer_tg_id)
       or (guest_tg_id = p_tg_id and host_tg_id = p_viewer_tg_id));

  return jsonb_build_object(
    'tg_id',           v_user.tg_id,
    'username',        v_user.username,
    'first_name',      v_user.first_name,
    'photo_url',       v_user.photo_url,
    'avatar_key',      v_user.avatar_key,
    'equipped_frame',  v_user.equipped_frame,
    'equipped_badge',  v_user.equipped_badge,
    'city',            v_user.city,
    'total_score',     v_user.total_score,
    'weekly_score',    v_user.weekly_score,
    'current_streak',  v_user.current_streak,
    'longest_streak',  v_user.longest_streak,
    'achievements',    v_achievements,
    'vs_me',           v_vs_me
  );
end $$;

-- Рейтинг "с кем реально играл" — тот же топ по weekly_score, что и
-- get_leaderboard, но только среди себя и тех, с кем есть хотя бы одна
-- завершённая дуэль (а не весь глобальный список игроков).
create or replace function public.get_circle_leaderboard(p_tg_id bigint, p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_top jsonb;
  v_me  jsonb;
begin
  select jsonb_agg(t) into v_top
    from (
      select
        row_number() over (order by u.weekly_score desc, u.tg_id asc) as rank,
        u.tg_id, u.username, u.first_name, u.photo_url, u.avatar_key,
        u.equipped_frame, u.equipped_badge, u.city, u.weekly_score, u.total_score
      from public.users u
      where u.tg_id = p_tg_id or u.tg_id in (
        select case when d.host_tg_id = p_tg_id then d.guest_tg_id else d.host_tg_id end
          from public.duels d
         where d.status = 'completed' and d.guest_tg_id is not null
           and (d.host_tg_id = p_tg_id or d.guest_tg_id = p_tg_id)
      )
      order by u.weekly_score desc, u.tg_id asc
      limit p_limit
    ) t;

  select to_jsonb(r) into v_me
    from (
      select
        row_number() over (order by u.weekly_score desc, u.tg_id asc) as rank,
        u.tg_id, u.username, u.first_name, u.photo_url, u.avatar_key,
        u.equipped_frame, u.equipped_badge, u.city, u.weekly_score, u.total_score
      from public.users u
      where u.tg_id = p_tg_id or u.tg_id in (
        select case when d.host_tg_id = p_tg_id then d.guest_tg_id else d.host_tg_id end
          from public.duels d
         where d.status = 'completed' and d.guest_tg_id is not null
           and (d.host_tg_id = p_tg_id or d.guest_tg_id = p_tg_id)
      )
    ) r
   where r.tg_id = p_tg_id;

  return jsonb_build_object('top', coalesce(v_top, '[]'::jsonb), 'me', v_me);
end $$;

revoke all on function public.get_player_profile(bigint, bigint) from public, anon, authenticated;
grant execute on function public.get_player_profile(bigint, bigint) to service_role;
revoke all on function public.get_circle_leaderboard(bigint, integer) from public, anon, authenticated;
grant execute on function public.get_circle_leaderboard(bigint, integer) to service_role;
