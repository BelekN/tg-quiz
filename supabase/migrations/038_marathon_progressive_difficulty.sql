-- ============================================================
-- Марафон: пул вопросов теперь не равномерно случайный, а идёт
-- волнами по сложности — лёгкие, потом средние, потом сложные,
-- вперемешку внутри каждой волны. Игрок реально чувствует, что чем
-- дальше держится серия, тем выше планка, а не играет в лотерею с
-- шансом сразу упереться в сложный вопрос на 2-м шаге.
-- ============================================================

-- меняется сигнатура (p_count -> три параметра по сложности) —
-- create or replace не заменит старую функцию с другим набором
-- аргументов, он просто создаст перегрузку рядом со старой.
drop function if exists public.start_marathon(bigint, integer);

create or replace function public.start_marathon(
  p_tg_id         bigint,
  p_easy_count    integer default 15,
  p_medium_count  integer default 25,
  p_hard_count    integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids       uuid[];
  v_session   public.marathon_sessions;
  v_questions jsonb;
  v_total     integer := p_easy_count + p_medium_count + p_hard_count;
begin
  select array_agg(id order by band, rnd) into v_ids
    from (
      (select id, 1 as band, random() as rnd
         from public.questions
        where is_active and difficulty = 'easy'
        order by random()
        limit p_easy_count)
      union all
      (select id, 2 as band, random() as rnd
         from public.questions
        where is_active and difficulty = 'medium'
        order by random()
        limit p_medium_count)
      union all
      (select id, 3 as band, random() as rnd
         from public.questions
        where is_active and difficulty = 'hard'
        order by random()
        limit p_hard_count)
    ) picked;

  if coalesce(array_length(v_ids, 1), 0) < v_total then
    raise exception 'NOT_ENOUGH_QUESTIONS';
  end if;

  insert into public.marathon_sessions (tg_id, question_ids)
  values (p_tg_id, v_ids)
  returning * into v_session;

  select jsonb_agg(
           jsonb_build_object(
             'id',       q.id,
             'question', q.question,
             'options',  public.shuffle_options(q.options, v_session.id::text || ':' || q.id::text),
             'category', q.category
           ) order by t.ord
         )
    into v_questions
    from unnest(v_session.question_ids) with ordinality as t(qid, ord)
    join public.questions q on q.id = t.qid;

  return jsonb_build_object(
    'session_id', v_session.id,
    'questions',  v_questions
  );
end $$;

revoke all on function public.start_marathon(bigint, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.start_marathon(bigint, integer, integer, integer) to service_role;
