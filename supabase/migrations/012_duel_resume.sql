-- ------------------------------------------------------------
-- Хост может вернуться в СВОЮ дуэль после сетевого сбоя
-- ------------------------------------------------------------
-- Раньше start_duel(p_duel_id = свой же duel_id) бросал DUEL_IS_YOURS
-- безусловно — это была защита от того, чтобы хост случайно "зашёл
-- гостем" по собственной инвайт-ссылке. Но из-за этого не было НИКАКОГО
-- способа вернуться в уже начатую дуэль, если answer_question/finish_duel
-- упал на сетевой ошибке посреди игры: хост просто терял доступ к своей
-- же дуэли (и к её инвайт-ссылке, которую мог уже отправить другу).
--
-- Разделяем два случая:
--   - p_tg_id = host_tg_id  -> это ВОЗВРАТ в свою дуэль, не переигровка:
--     ниже по коду уже есть подсчёт answered/correct и ALREADY_PLAYED,
--     так что повторно ответить на уже отвеченные вопросы всё равно
--     нельзя — резюм не даёт никакого преимущества, только продолжение.
--   - иначе (чужой tg_id) -> прежняя логика гостя (занять слот/проверить
--     статус) не меняется.
create or replace function public.start_duel(
  p_tg_id            bigint,
  p_duel_id          uuid default null,
  p_questions_count  integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel      public.duels;
  v_role      text;
  v_ids       uuid[];
  v_questions jsonb;
  v_answered  integer;
  v_correct   integer;
begin
  if p_duel_id is null then
    -- ---- ХОСТ: набираем случайные вопросы ----
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
    returning * into v_duel;

    v_role := 'host';
  else
    select * into v_duel from public.duels where id = p_duel_id for update;
    if not found then
      raise exception 'DUEL_NOT_FOUND';
    end if;

    if v_duel.host_tg_id = p_tg_id then
      -- хост возвращается в свою же дуэль (например, после сетевой
      -- ошибки посреди игры) — это не переигровка, answered/correct
      -- ниже и так не дадут ответить на уже пройденные вопросы.
      v_role := 'host';
    else
      if v_duel.status = 'completed' then
        raise exception 'DUEL_ALREADY_COMPLETED';
      end if;

      if v_duel.guest_tg_id is not null and v_duel.guest_tg_id <> p_tg_id then
        raise exception 'DUEL_ALREADY_TAKEN';
      end if;

      if v_duel.guest_tg_id is null then
        update public.duels set guest_tg_id = p_tg_id
         where id = v_duel.id
        returning * into v_duel;
      end if;

      v_role := 'guest';
    end if;
  end if;

  -- Сколько уже отвечено? Игрок мог закрыть приложение на
  -- середине — тогда продолжаем с того же вопроса, а не с нуля
  -- (иначе answer_question вернёт OUT_OF_ORDER_ANSWER).
  select count(*), count(*) filter (where is_correct)
    into v_answered, v_correct
    from public.duel_answers
   where duel_id = v_duel.id and tg_id = p_tg_id;

  if v_answered >= array_length(v_duel.question_ids, 1) then
    raise exception 'ALREADY_PLAYED';
  end if;

  -- порядок вопросов = порядок в question_ids, а не порядок из БД
  select jsonb_agg(
           jsonb_build_object(
             'id',       q.id,
             'question', q.question,
             'options',  q.options,
             'category', q.category
           ) order by t.ord
         )
    into v_questions
    from unnest(v_duel.question_ids) with ordinality as t(qid, ord)
    join public.questions q on q.id = t.qid;

  return jsonb_build_object(
    'duel_id',   v_duel.id,
    'role',      v_role,
    'status',    v_duel.status,
    'questions', v_questions,
    -- с какого вопроса продолжать (0 для новой дуэли)
    'answered',  v_answered,
    'correct',   v_correct
  );
end $$;
