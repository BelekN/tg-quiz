-- ============================================================
-- Соло-режим «Квиз-тесты»: тематическая подборка без таймера.
-- Та же модель защиты, что и в дуэлях: правильный ответ отдаётся
-- только после фиксации выбора, порядок вопросов принудительный,
-- очки считает Postgres.
-- ============================================================

create table if not exists public.solo_sessions (
  id           uuid primary key default gen_random_uuid(),
  tg_id        bigint  not null references public.users (tg_id) on delete cascade,
  category     text    not null,
  question_ids uuid[]  not null,
  status       text    not null default 'pending' check (status in ('pending', 'completed')),
  score        integer,
  coins_earned integer,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists solo_sessions_tg_idx
  on public.solo_sessions (tg_id, created_at desc);

create table if not exists public.solo_answers (
  session_id     uuid     not null references public.solo_sessions (id) on delete cascade,
  question_index smallint not null,
  question_id    uuid     not null references public.questions (id),
  answer_index   smallint,          -- null = пропустил / не ответил
  is_correct     boolean  not null,
  points         integer  not null,
  created_at     timestamptz not null default now(),
  primary key (session_id, question_index)
);

alter table public.solo_sessions enable row level security;
alter table public.solo_answers  enable row level security;

-- ------------------------------------------------------------
-- get_categories — список категорий с кол-вом активных вопросов
-- ------------------------------------------------------------
create or replace function public.get_categories()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object('category', c.category, 'count', c.count)
                   order by c.category), '[]'::jsonb)
    from (
      select category, count(*) as count
        from public.questions
       where is_active
       group by category
    ) c;
$$;

-- ------------------------------------------------------------
-- start_solo — набрать вопросы категории и создать сессию
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
       where is_active and category = p_category
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

-- ------------------------------------------------------------
-- answer_solo — записать ответ, вернуть правильный (та же схема
-- защиты, что и answer_question для дуэлей)
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
  v_right    smallint;
  v_correct  boolean;
  v_points   integer := 0;
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
  select correct_option_index into v_right from public.questions where id = v_qid;

  v_correct := p_answer is not null and p_answer = v_right;
  -- без бонуса за скорость: таймера в этом режиме нет
  if v_correct then v_points := 100; end if;

  insert into public.solo_answers (session_id, question_index, question_id, answer_index, is_correct, points)
  values (p_session_id, p_index, v_qid, p_answer, v_correct, v_points);

  return jsonb_build_object(
    'correct_option_index', v_right,
    'is_correct',           v_correct,
    'points',               v_points
  );
end $$;

-- ------------------------------------------------------------
-- finish_solo — итог считается из solo_answers, не из запроса
-- ------------------------------------------------------------
create or replace function public.finish_solo(
  p_tg_id      bigint,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session  public.solo_sessions;
  v_total    integer;
  v_answered integer;
  v_correct  integer;
  v_score    integer;
  v_coins    integer;
  v_balance  integer;
begin
  select * into v_session from public.solo_sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.tg_id <> p_tg_id then raise exception 'NOT_A_PARTICIPANT'; end if;
  if v_session.status = 'completed' then raise exception 'ALREADY_COMPLETED'; end if;

  v_total := array_length(v_session.question_ids, 1);

  select count(*), count(*) filter (where is_correct), coalesce(sum(points), 0)
    into v_answered, v_correct, v_score
    from public.solo_answers where session_id = p_session_id;

  if v_answered <> v_total then
    raise exception 'INCOMPLETE_SESSION';
  end if;

  v_coins := v_correct * 5;

  update public.solo_sessions
     set status = 'completed', score = v_score, coins_earned = v_coins, completed_at = now()
   where id = p_session_id;

  update public.users
     set total_score = total_score + v_score,
         coins       = coins + v_coins,
         updated_at  = now()
   where tg_id = p_tg_id
  returning coins into v_balance;

  return jsonb_build_object(
    'session_id',    p_session_id,
    'category',      v_session.category,
    'correct',       v_correct,
    'total',         v_total,
    'score',         v_score,
    'coins_earned',  v_coins,
    'coins_balance', v_balance
  );
end $$;

-- ------------------------------------------------------------
-- Права: только service_role, как и весь остальной API
-- ------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.get_categories()',
    'public.start_solo(bigint, text, integer)',
    'public.answer_solo(bigint, uuid, integer, smallint)',
    'public.finish_solo(bigint, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
