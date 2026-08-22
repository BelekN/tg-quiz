-- ============================================================
-- 10 готовых аватарок на выбор (см. src/lib/avatars.js — те же
-- ключи). avatar_key = null -> используем фото из Telegram/инициал,
-- как и раньше.
-- ============================================================

alter table public.users add column if not exists avatar_key text;

alter table public.users
  add constraint users_avatar_key_valid
  check (avatar_key is null or avatar_key in (
    'fox', 'owl', 'cat', 'robot', 'dragon',
    'panda', 'lion', 'octopus', 'alien', 'astronaut'
  ));

-- ------------------------------------------------------------
-- set_avatar — сохранить выбранную аватарку
-- ------------------------------------------------------------
create or replace function public.set_avatar(
  p_tg_id      bigint,
  p_avatar_key text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
begin
  if p_avatar_key is not null and p_avatar_key not in (
    'fox', 'owl', 'cat', 'robot', 'dragon',
    'panda', 'lion', 'octopus', 'alien', 'astronaut'
  ) then
    raise exception 'INVALID_AVATAR';
  end if;

  update public.users
     set avatar_key = p_avatar_key, updated_at = now()
   where tg_id = p_tg_id
  returning * into v_user;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  return v_user;
end $$;

revoke all on function public.set_avatar(bigint, text) from public, anon, authenticated;
grant execute on function public.set_avatar(bigint, text) to service_role;

-- ------------------------------------------------------------
-- get_leaderboard — переиздана с добавлением avatar_key в выдачу
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
        tg_id, username, first_name, photo_url, avatar_key, city, total_score, coins
      from public.users
      order by total_score desc, tg_id asc
      limit p_limit
    ) t;

  select to_jsonb(r) into v_me
    from (
      select
        row_number() over (order by total_score desc, tg_id asc) as rank,
        tg_id, username, first_name, photo_url, avatar_key, city, total_score, coins
      from public.users
    ) r
   where r.tg_id = p_tg_id;

  return jsonb_build_object(
    'top', coalesce(v_top, '[]'::jsonb),
    'me',  v_me
  );
end $$;
