-- ============================================================
-- Варианты ответа перемешиваются на каждый новый заход, чтобы нельзя
-- было запомнить номер правильного варианта вместо самого ответа.
--
-- Подход: детерминированный сид вида "<duel/session id>:<question id>"
-- вместо хранения порядка в отдельной колонке. Один и тот же сид даёт
-- один и тот же порядок и при показе вопроса (start_*), и при проверке
-- ответа (answer_*) — а поскольку duel_id/session_id каждый раз новый,
-- при повторном попадании того же вопроса порядок будет другим. Фронт
-- не меняется: он как и раньше просто рисует присланный options[] и
-- подсвечивает присланный correct_option_index.
-- ============================================================

-- ------------------------------------------------------------
-- shuffle_options — переставляет варианты по сиду. Сортировка по
-- md5(seed || ':' || idx) — псевдослучайно, но воспроизводимо для
-- одного и того же сида.
-- ------------------------------------------------------------
create or replace function public.shuffle_options(p_options text[], p_seed text)
returns text[]
language sql
immutable
as $$
  select array_agg(p_options[idx] order by md5(p_seed || ':' || idx))
    from generate_series(1, array_length(p_options, 1)) as idx;
$$;

-- ------------------------------------------------------------
-- shuffled_correct_index — на какой позиции в перемешанном по тому же
-- сиду массиве оказался правильный вариант (0-based, как и исходный
-- correct_option_index). Ранг ключа сортировки == позиция после сортировки.
-- ------------------------------------------------------------
create or replace function public.shuffled_correct_index(
  p_options       text[],
  p_seed          text,
  p_correct_index integer
)
returns smallint
language sql
immutable
as $$
  select (count(*) - 1)::smallint
    from generate_series(1, array_length(p_options, 1)) as idx
   where md5(p_seed || ':' || idx) <= md5(p_seed || ':' || (p_correct_index + 1));
$$;

revoke all on function public.shuffle_options(text[], text) from public, anon, authenticated;
revoke all on function public.shuffled_correct_index(text[], text, integer) from public, anon, authenticated;
grant execute on function public.shuffle_options(text[], text) to service_role;
grant execute on function public.shuffled_correct_index(text[], text, integer) to service_role;

-- ------------------------------------------------------------
-- start_duel — та же логика, что в 012_duel_resume.sql, options
-- перемешиваются по сиду "<duel_id>:<question_id>".
-- ------------------------------------------------------------
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
             'options',  public.shuffle_options(q.options, v_duel.id::text || ':' || q.id::text),
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

-- ------------------------------------------------------------
-- rematch_duel — новая дуэль (новый id), поэтому новый сид сам
-- собой даёт другой порядок, даже если попался тот же вопрос.
-- ------------------------------------------------------------
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
             'options',  public.shuffle_options(q.options, v_new.id::text || ':' || q.id::text),
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

-- ------------------------------------------------------------
-- start_solo — сид "<session_id>:<question_id>".
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- start_sprint — сид "<session_id>:<question_id>".
-- ------------------------------------------------------------
create or replace function public.start_sprint(
  p_tg_id bigint,
  p_count integer default 40
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids       uuid[];
  v_session   public.sprint_sessions;
  v_questions jsonb;
begin
  select array_agg(q.id) into v_ids
    from (
      select id from public.questions
       where is_active
       order by random()
       limit p_count
    ) q;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'NO_QUESTIONS';
  end if;

  insert into public.sprint_sessions (tg_id, question_ids)
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
    'started_at', v_session.started_at,
    'duration_ms', 60000,
    'questions',  v_questions
  );
end $$;

-- ------------------------------------------------------------
-- answer_question — тот же сид "<duel_id>:<question_id>" переводит
-- p_answer (индекс в перемешанном порядке) в исходный correct_option_index
-- и обратно: correct_option_index в ответе — тоже в перемешанных
-- координатах, чтобы фронт подсветил именно ту кнопку, что показывал.
-- ------------------------------------------------------------
create or replace function public.answer_question(
  p_tg_id      bigint,
  p_duel_id    uuid,
  p_index      integer,      -- 0-based
  p_answer     smallint,     -- null = таймаут
  p_elapsed_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel     public.duels;
  v_expected integer;
  v_qid      uuid;
  v_options  text[];
  v_right    smallint;
  v_shuffled_right smallint;
  v_correct  boolean;
  v_elapsed  integer;
  v_points   integer := 0;
  v_seed     text;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then
    raise exception 'DUEL_NOT_FOUND';
  end if;

  if p_tg_id <> v_duel.host_tg_id
     and p_tg_id <> coalesce(v_duel.guest_tg_id, -1) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  if p_index < 0 or p_index >= array_length(v_duel.question_ids, 1) then
    raise exception 'BAD_QUESTION_INDEX';
  end if;

  select count(*) into v_expected
    from public.duel_answers
   where duel_id = p_duel_id and tg_id = p_tg_id;

  if p_index <> v_expected then
    raise exception 'OUT_OF_ORDER_ANSWER';
  end if;

  v_qid := v_duel.question_ids[p_index + 1];  -- массивы в PG 1-based
  select options, correct_option_index into v_options, v_right
    from public.questions where id = v_qid;

  v_seed := p_duel_id::text || ':' || v_qid::text;
  v_shuffled_right := public.shuffled_correct_index(v_options, v_seed, v_right);

  -- времени доверяем ограниченно: клампим в [0, 10000]
  v_elapsed := least(greatest(coalesce(p_elapsed_ms, 10000), 0), 10000);
  v_correct := p_answer is not null and p_answer = v_shuffled_right;

  if v_correct then
    -- 100 за правильный ответ + до 100 бонуса за скорость
    v_points := 100 + ((10000 - v_elapsed) / 100);
  end if;

  insert into public.duel_answers (
    duel_id, tg_id, question_index, question_id,
    answer_index, is_correct, elapsed_ms, points
  )
  values (
    p_duel_id, p_tg_id, p_index, v_qid,
    p_answer, v_correct, v_elapsed, v_points
  );

  return jsonb_build_object(
    'correct_option_index', v_shuffled_right,
    'is_correct',           v_correct,
    'points',               v_points
  );
end $$;

-- ------------------------------------------------------------
-- answer_solo — сид "<session_id>:<question_id>".
-- ------------------------------------------------------------
create or replace function public.answer_solo(
  p_tg_id      bigint,
  p_session_id uuid,
  p_index      integer,
  p_answer     smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session  public.solo_sessions;
  v_expected integer;
  v_qid      uuid;
  v_options  text[];
  v_right    smallint;
  v_shuffled_right smallint;
  v_correct  boolean;
  v_points   integer := 0;
  v_seed     text;
begin
  select * into v_session from public.solo_sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.tg_id <> p_tg_id then raise exception 'NOT_A_PARTICIPANT'; end if;
  if v_session.status = 'completed' then raise exception 'ALREADY_COMPLETED'; end if;

  if p_index < 0 or p_index >= array_length(v_session.question_ids, 1) then
    raise exception 'BAD_QUESTION_INDEX';
  end if;

  select count(*) into v_expected
    from public.solo_answers where session_id = p_session_id;

  if p_index <> v_expected then
    raise exception 'OUT_OF_ORDER_ANSWER';
  end if;

  v_qid := v_session.question_ids[p_index + 1];
  select options, correct_option_index into v_options, v_right
    from public.questions where id = v_qid;

  v_seed := p_session_id::text || ':' || v_qid::text;
  v_shuffled_right := public.shuffled_correct_index(v_options, v_seed, v_right);

  v_correct := p_answer is not null and p_answer = v_shuffled_right;
  -- без бонуса за скорость: таймера в этом режиме нет
  if v_correct then v_points := 100; end if;

  insert into public.solo_answers (session_id, question_index, question_id, answer_index, is_correct, points)
  values (p_session_id, p_index, v_qid, p_answer, v_correct, v_points);

  return jsonb_build_object(
    'correct_option_index', v_shuffled_right,
    'is_correct',           v_correct,
    'points',               v_points
  );
end $$;

-- ------------------------------------------------------------
-- answer_sprint — сид "<session_id>:<question_id>".
-- ------------------------------------------------------------
create or replace function public.answer_sprint(
  p_tg_id      bigint,
  p_session_id uuid,
  p_index      integer,
  p_answer     smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session  public.sprint_sessions;
  v_expected integer;
  v_qid      uuid;
  v_options  text[];
  v_right    smallint;
  v_shuffled_right smallint;
  v_correct  boolean;
  v_points   integer := 0;
  v_seed     text;
begin
  select * into v_session from public.sprint_sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.tg_id <> p_tg_id then raise exception 'NOT_A_PARTICIPANT'; end if;
  if v_session.status = 'completed' then raise exception 'ALREADY_COMPLETED'; end if;

  if now() > v_session.started_at + interval '60 seconds' then
    raise exception 'SPRINT_TIME_UP';
  end if;

  if p_index < 0 or p_index >= array_length(v_session.question_ids, 1) then
    raise exception 'BAD_QUESTION_INDEX';
  end if;

  select count(*) into v_expected
    from public.sprint_answers where session_id = p_session_id;

  if p_index <> v_expected then
    raise exception 'OUT_OF_ORDER_ANSWER';
  end if;

  v_qid := v_session.question_ids[p_index + 1];
  select options, correct_option_index into v_options, v_right
    from public.questions where id = v_qid;

  v_seed := p_session_id::text || ':' || v_qid::text;
  v_shuffled_right := public.shuffled_correct_index(v_options, v_seed, v_right);

  v_correct := p_answer is not null and p_answer = v_shuffled_right;
  -- без бонуса за скорость вопроса: тут в целом играют на скорость
  if v_correct then v_points := 50; end if;

  insert into public.sprint_answers (session_id, question_index, question_id, answer_index, is_correct, points)
  values (p_session_id, p_index, v_qid, p_answer, v_correct, v_points);

  return jsonb_build_object(
    'correct_option_index', v_shuffled_right,
    'is_correct',           v_correct,
    'points',               v_points
  );
end $$;
