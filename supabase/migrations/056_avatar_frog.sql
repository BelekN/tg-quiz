-- ============================================================
-- 11-й аватар "Лягушка" (frog) — тот же список, что в
-- 009_avatars.sql, только с добавленным ключом. Констрейнт нельзя
-- поменять на месте — дропаем и создаём заново.
-- ============================================================

alter table public.users drop constraint if exists users_avatar_key_valid;

alter table public.users
  add constraint users_avatar_key_valid
  check (avatar_key is null or avatar_key in (
    'fox', 'owl', 'cat', 'robot', 'dragon',
    'panda', 'lion', 'octopus', 'alien', 'astronaut', 'frog'
  ));

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
    'panda', 'lion', 'octopus', 'alien', 'astronaut', 'frog'
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
