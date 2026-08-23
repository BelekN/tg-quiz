-- ------------------------------------------------------------
-- Реванш: новая дуэль с тем же соперником, что и в завершённой
-- ------------------------------------------------------------
-- Переиспользует ту же механику, что и start_duel(p_duel_id=null) для
-- хоста (случайные вопросы, новая строка duels), но дополнительно
-- вычисляет tg_id соперника из уже завершённой дуэли и отдаёт его
-- наружу — tg-api пушит ему приглашение на новую дуэль отдельным
-- сообщением (там же, где остальные пуши через sendTelegramMessage).
create or replace function public.rematch_duel(
  p_tg_id           bigint,
  p_duel_id         uuid,
  p_questions_count integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old       public.duels;
  v_rival_id  bigint;
  v_ids       uuid[];
  v_new       public.duels;
  v_questions jsonb;
begin
  select * into v_old from public.duels where id = p_duel_id;
  if not found then
    raise exception 'DUEL_NOT_FOUND';
  end if;

  if p_tg_id <> v_old.host_tg_id and p_tg_id <> coalesce(v_old.guest_tg_id, -1) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  -- Реванш имеет смысл только когда известны оба участника и оба счёта
  -- (иначе кто соперник — не факт, что кто-то даже присоединился).
  if v_old.host_score is null or v_old.guest_score is null then
    raise exception 'DUEL_NOT_FINISHED';
  end if;

  v_rival_id := case
    when p_tg_id = v_old.host_tg_id then v_old.guest_tg_id
    else v_old.host_tg_id
  end;

  select array_agg(q.id) into v_ids
    from (
      select id from public.questions
       where is_active
       order by random()
       limit p_questions_count
    ) q;

  if coalesce(array_length(v_ids, 1), 0) < p_questions_count then
    raise exception 'NOT_ENOUGH_QUESTIONS';
  end if;

  insert into public.duels (host_tg_id, question_ids)
  values (p_tg_id, v_ids)
  returning * into v_new;

  select jsonb_agg(
           jsonb_build_object(
             'id',       q.id,
             'question', q.question,
             'options',  q.options,
             'category', q.category
           ) order by t.ord
         )
    into v_questions
    from unnest(v_new.question_ids) with ordinality as t(qid, ord)
    join public.questions q on q.id = t.qid;

  return jsonb_build_object(
    'duel_id',     v_new.id,
    'role',        'host',
    'status',      v_new.status,
    'questions',   v_questions,
    'answered',    0,
    'correct',     0,
    'rival_tg_id', v_rival_id
  );
end $$;

revoke all on function public.rematch_duel(bigint, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.rematch_duel(bigint, uuid, integer)
  to service_role;
