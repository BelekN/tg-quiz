-- ============================================================
-- Расширенный результат теста на совместимость: по каждому вопросу —
-- ответ мой / партнёра и совпал ли он, а не только итоговый %.
-- Доступно только когда сессия ЗАВЕРШЕНА (оба ответили) — иначе это
-- был бы способ подсмотреть ответы партнёра раньше времени и
-- подогнать свои под совпадение.
--
-- option_index в compat_answers — индекс в ПЕРЕМЕШАННОМ для этой
-- сессии списке вариантов (см. start_compat: order by
-- md5(session_id:question_id:ord)), поэтому текст ответа
-- восстанавливаем той же сортировкой, а не по исходному ord.
-- ============================================================

create or replace function public.get_compat_detail(
  p_tg_id      bigint,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_session  public.compat_sessions;
  v_other_id bigint;
  v_items    jsonb;
begin
  select * into v_session from public.compat_sessions where id = p_session_id;
  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if p_tg_id <> v_session.host_tg_id and p_tg_id <> coalesce(v_session.guest_tg_id, -1) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  if v_session.status <> 'completed' then
    raise exception 'SESSION_NOT_COMPLETED';
  end if;

  v_other_id := case when p_tg_id = v_session.host_tg_id then v_session.guest_tg_id else v_session.host_tg_id end;

  select jsonb_agg(
           jsonb_build_object(
             'question', cq.question,
             'my_answer', (
               select o.label from public.compat_options o
                where o.question_id = cq.id
                order by md5(p_session_id::text || ':' || cq.id::text || ':' || o.ord)
                offset ma.option_index limit 1
             ),
             'partner_answer', (
               select o.label from public.compat_options o
                where o.question_id = cq.id
                order by md5(p_session_id::text || ':' || cq.id::text || ':' || o.ord)
                offset pa.option_index limit 1
             ),
             'matched', ma.option_index = pa.option_index
           ) order by cq.ord
         )
    into v_items
    from public.compat_questions cq
    join public.compat_answers ma
      on ma.session_id = p_session_id and ma.question_id = cq.id and ma.tg_id = p_tg_id
    join public.compat_answers pa
      on pa.session_id = p_session_id and pa.question_id = cq.id and pa.tg_id = v_other_id
   where cq.id = any(v_session.question_ids);

  return jsonb_build_object(
    'items',         coalesce(v_items, '[]'::jsonb),
    'match_percent', v_session.match_percent
  );
end $$;

revoke all on function public.get_compat_detail(bigint, uuid) from public, anon, authenticated;
grant execute on function public.get_compat_detail(bigint, uuid) to service_role;
