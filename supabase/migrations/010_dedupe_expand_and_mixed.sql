-- ============================================================
-- "Случайный микс" для Квиз-тестов: start_solo(p_category='mixed')
-- берёт вопросы из ВСЕХ категорий вместо одной.
--
-- Эта же миграция когда-то гасила почти-дубли (is_active=false)
-- и добавляла 178 вопросов (10-я категория "food" + расширение
-- остальных 9 до 50 каждая). Та часть — чистые данные, теперь
-- целиком отражена в supabase/questions/bank.sql, который и есть
-- единственный актуальный срез базы вопросов. Здесь остаётся
-- только реальное изменение поведения — сама функция.
-- ============================================================

create or replace function public.start_solo(
  p_tg_id    bigint,
  p_category text,
  p_count    integer default 10
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
             'options',  q.options,
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
