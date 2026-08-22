-- ============================================================
-- Таблица лидеров (общий рейтинг по total_score).
-- Недельный рейтинг — отдельная задача на будущее (требует
-- отдельного окна очков, не трогаем total_score).
-- ============================================================

create or replace function public.get_leaderboard(
  p_tg_id  bigint,
  p_limit  integer default 20
)
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
        row_number() over (order by total_score desc, tg_id asc) as rank,
        tg_id, username, first_name, photo_url, total_score, coins
      from public.users
      order by total_score desc, tg_id asc
      limit p_limit
    ) t;

  select to_jsonb(r) into v_me
    from (
      select
        row_number() over (order by total_score desc, tg_id asc) as rank,
        tg_id, username, first_name, photo_url, total_score, coins
      from public.users
    ) r
   where r.tg_id = p_tg_id;

  return jsonb_build_object(
    'top', coalesce(v_top, '[]'::jsonb),
    'me',  v_me
  );
end $$;

revoke all on function public.get_leaderboard(bigint, integer) from public, anon, authenticated;
grant execute on function public.get_leaderboard(bigint, integer) to service_role;
