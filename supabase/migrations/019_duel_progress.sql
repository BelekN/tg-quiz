-- ------------------------------------------------------------
-- Прогресс соперника — клиент поллит это раз в несколько секунд,
-- вместо настоящего Supabase Realtime (решили не заводить прямое
-- подключение клиента к Supabase ради одной фичи).
-- ------------------------------------------------------------
create or replace function public.get_duel_progress(
  p_tg_id   bigint,
  p_duel_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel         public.duels;
  v_opp_id       bigint;
  v_opp_answered integer;
  v_opp_score    integer;
  v_my_score     integer;
  v_total        integer;
  v_outcome      text := 'pending';
begin
  select * into v_duel from public.duels where id = p_duel_id;
  if not found then
    raise exception 'DUEL_NOT_FOUND';
  end if;

  if p_tg_id <> v_duel.host_tg_id and p_tg_id <> coalesce(v_duel.guest_tg_id, -1) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  v_total  := array_length(v_duel.question_ids, 1);
  v_opp_id := case when p_tg_id = v_duel.host_tg_id then v_duel.guest_tg_id else v_duel.host_tg_id end;

  if v_opp_id is null then
    return jsonb_build_object(
      'opponent_joined',   false,
      'opponent_answered', 0,
      'opponent_finished', false,
      'opponent_score',    null,
      'total',             v_total,
      'outcome',           'pending'
    );
  end if;

  select count(*) into v_opp_answered
    from public.duel_answers
   where duel_id = p_duel_id and tg_id = v_opp_id;

  v_opp_score := case when p_tg_id = v_duel.host_tg_id then v_duel.guest_score else v_duel.host_score end;
  v_my_score  := case when p_tg_id = v_duel.host_tg_id then v_duel.host_score  else v_duel.guest_score end;

  if v_opp_score is not null and v_my_score is not null then
    v_outcome := case
                   when v_my_score > v_opp_score then 'win'
                   when v_my_score < v_opp_score then 'lose'
                   else 'draw'
                 end;
  end if;

  return jsonb_build_object(
    'opponent_joined',   true,
    'opponent_answered', v_opp_answered,
    'opponent_finished', v_opp_score is not null,
    'opponent_score',    v_opp_score,
    'total',             v_total,
    'outcome',           v_outcome
  );
end $$;

revoke all on function public.get_duel_progress(bigint, uuid) from public, anon, authenticated;
grant execute on function public.get_duel_progress(bigint, uuid) to service_role;
