-- ============================================================
-- Город пользователя — вводится один раз вручную (Telegram
-- не отдаёт геоданные через initData, самостоятельный ввод —
-- единственный надёжный вариант без запроса геолокации).
-- ============================================================

alter table public.users add column if not exists city text;

-- ------------------------------------------------------------
-- set_city — сохранить/обновить город
-- ------------------------------------------------------------
create or replace function public.set_city(
  p_tg_id bigint,
  p_city  text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_city text;
  v_user public.users;
begin
  v_city := nullif(trim(p_city), '');
  if v_city is not null then
    v_city := left(v_city, 60);
  end if;

  update public.users
     set city = v_city, updated_at = now()
   where tg_id = p_tg_id
  returning * into v_user;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  return v_user;
end $$;

revoke all on function public.set_city(bigint, text) from public, anon, authenticated;
grant execute on function public.set_city(bigint, text) to service_role;

-- ------------------------------------------------------------
-- get_leaderboard — переиздана с добавлением city в выдачу
-- ------------------------------------------------------------
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
        tg_id, username, first_name, photo_url, city, total_score, coins
      from public.users
      order by total_score desc, tg_id asc
      limit p_limit
    ) t;

  select to_jsonb(r) into v_me
    from (
      select
        row_number() over (order by total_score desc, tg_id asc) as rank,
        tg_id, username, first_name, photo_url, city, total_score, coins
      from public.users
    ) r
   where r.tg_id = p_tg_id;

  return jsonb_build_object(
    'top', coalesce(v_top, '[]'::jsonb),
    'me',  v_me
  );
end $$;
