-- ------------------------------------------------------------
-- start_persona: варианты ответа перемешиваются на каждый заход.
--
-- Раньше options шли в порядке o.ord — а контент (personas.sql) заводил
-- их в одном и том же порядке для каждого вопроса (например, "шутник"
-- всегда 4-м), так что штрих угадывался по позиции, а не по смыслу.
-- В отличие от дуэли/соло/спринта здесь не нужен детерминированный сид:
-- каждая опция и так несёт свой result_key/value прямо в ответе, так
-- что порядок чисто косметический — обычный order by random() достаточен.
-- ------------------------------------------------------------
create or replace function public.start_persona(
  p_tg_id    bigint,
  p_test_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test      public.persona_tests;
  v_session   public.persona_sessions;
  v_questions jsonb;
  v_results   jsonb;
begin
  select * into v_test from public.persona_tests where key = p_test_key;
  if not found then
    raise exception 'TEST_NOT_FOUND';
  end if;

  insert into public.persona_sessions (tg_id, test_key)
  values (p_tg_id, p_test_key)
  returning * into v_session;

  select jsonb_agg(
           jsonb_build_object(
             'id',       q.id,
             'question', q.question,
             'options',  (
               select jsonb_agg(
                        jsonb_build_object(
                          'label',      o.label,
                          'result_key', o.result_key,
                          'value',      o.value
                        ) order by random()
                      )
                 from public.persona_options o
                where o.question_id = q.id
             )
           ) order by q.ord
         )
    into v_questions
    from public.persona_questions q
   where q.test_key = p_test_key;

  select jsonb_agg(
           jsonb_build_object(
             'key', r.key, 'min_score', r.min_score, 'max_score', r.max_score
           ) order by r.ord
         )
    into v_results
    from public.persona_results r
   where r.test_key = p_test_key;

  return jsonb_build_object(
    'session_id', v_session.id,
    'test_key',   v_test.key,
    'title',      v_test.title,
    'scoring',    v_test.scoring,
    'questions',  v_questions,
    'results',    v_results
  );
end $$;
