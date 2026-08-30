-- ============================================================
-- Исходящие вызовы: кого вызвал я сам и что там с ответом — не только
-- "кто вызвал меня" (get_duel_challenges), но и обратная сторона,
-- чтобы видеть, кто ответил, а кто ещё нет, и чем закончилось.
-- ============================================================

create or replace function public.get_sent_duel_challenges(p_tg_id bigint, p_limit integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'duel_id',    d.id,
           'created_at', d.created_at,
           'status',     d.status,
           'host_score', d.host_score,
           'guest_score', d.guest_score,
           'target', jsonb_build_object(
             'tg_id',          u.tg_id,
             'username',       u.username,
             'first_name',     u.first_name,
             'photo_url',      u.photo_url,
             'avatar_key',     u.avatar_key,
             'equipped_frame', u.equipped_frame
           )
         ) order by d.created_at desc), '[]'::jsonb)
    into v_result
    from (
      select * from public.duels
       where host_tg_id = p_tg_id and invited_tg_id is not null
       order by created_at desc
       limit p_limit
    ) d
    join public.users u on u.tg_id = d.invited_tg_id;

  return v_result;
end $$;

revoke all on function public.get_sent_duel_challenges(bigint, integer) from public, anon, authenticated;
grant execute on function public.get_sent_duel_challenges(bigint, integer) to service_role;
