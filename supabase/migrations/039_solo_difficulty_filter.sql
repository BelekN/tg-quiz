-- ============================================================
-- Квиз-тесты: необязательный фильтр по сложности. p_difficulty
-- null (по умолчанию) — как раньше, без фильтра по сложности.
-- ============================================================

-- новый необязательный параметр — старую сигнатуру (без него) нужно
-- убрать явно, иначе call с {p_tg_id, p_category, p_count} стал бы
-- неоднозначным между двумя перегрузками.
drop function if exists public.start_solo(bigint, text, integer);

create or replace function public.start_solo(
  p_tg_id      bigint,
  p_category   text,
  p_count      integer default 10,
  p_difficulty public.question_difficulty default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids       uuid[];
  v_session   public.solo_sessions;
  v_questions jsonb;
begin
  select array_agg(q.id) into v_ids
    from (
      select id from public.questions
       where is_active
         and (p_category = 'mixed' or category = p_category)
         and (p_difficulty is null or difficulty = p_difficulty)
       order by random()
       limit p_count
    ) q;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'NO_QUESTIONS_IN_CATEGORY';
  end if;

  insert into public.solo_sessions (tg_id, category, question_ids)
  values (p_tg_id, p_category, v_ids)
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
    'category',   v_session.category,
    'questions',  v_questions
  );
end $$;

revoke all on function public.start_solo(bigint, text, integer, public.question_difficulty) from public, anon, authenticated;
grant execute on function public.start_solo(bigint, text, integer, public.question_difficulty) to service_role;
