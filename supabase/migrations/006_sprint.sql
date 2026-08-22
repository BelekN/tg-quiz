-- ============================================================
-- Режим «Спринт»: 60 секунд на максимум верных ответов подряд.
-- Вопросы вперемешку по всем категориям, без паузы на раздумье.
-- Дедлайн — только на сервере (started_at + 60s), поэтому подделать
-- время из клиента нельзя: просроченный ответ Postgres просто отклонит.
-- ============================================================

create table if not exists public.sprint_sessions (
  id           uuid primary key default gen_random_uuid(),
  tg_id        bigint  not null references public.users (tg_id) on delete cascade,
  question_ids uuid[]  not null,
  status       text    not null default 'pending' check (status in ('pending', 'completed')),
  score        integer,
  coins_earned integer,
  started_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists sprint_sessions_tg_idx
  on public.sprint_sessions (tg_id, started_at desc);

create table if not exists public.sprint_answers (
  session_id     uuid     not null references public.sprint_sessions (id) on delete cascade,
  question_index smallint not null,
  question_id    uuid     not null references public.questions (id),
  answer_index   smallint,
  is_correct     boolean  not null,
  points         integer  not null,
  created_at     timestamptz not null default now(),
  primary key (session_id, question_index)
);

alter table public.sprint_sessions enable row level security;
alter table public.sprint_answers  enable row level security;

-- ------------------------------------------------------------
-- start_sprint — набрать вопросы вперемешку и создать сессию.
-- Пул с запасом (по умолчанию 40): реальный игрок за 60 секунд
-- столько не осилит, но если вдруг осилит — sprint просто
-- завершится досрочно, когда вопросы кончатся.
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
             'options',  q.options,
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
-- answer_sprint — та же защита, что в дуэли/соло, плюс дедлайн:
-- ответ, пришедший позже started_at + 60s, сервер не примет.
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
  v_right    smallint;
  v_correct  boolean;
  v_points   integer := 0;
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
  select correct_option_index into v_right from public.questions where id = v_qid;

  v_correct := p_answer is not null and p_answer = v_right;
  -- без бонуса за скорость вопроса: тут в целом играют на скорость
  if v_correct then v_points := 50; end if;

  insert into public.sprint_answers (session_id, question_index, question_id, answer_index, is_correct, points)
  values (p_session_id, p_index, v_qid, p_answer, v_correct, v_points);

  return jsonb_build_object(
    'correct_option_index', v_right,
    'is_correct',           v_correct,
    'points',               v_points
  );
end $$;

-- ------------------------------------------------------------
-- finish_sprint — итог из sprint_answers. В отличие от соло,
-- полный разбор пула не требуется: игрок мог не успеть всё.
-- ------------------------------------------------------------
create or replace function public.finish_sprint(
  p_tg_id      bigint,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session  public.sprint_sessions;
  v_answered integer;
  v_correct  integer;
  v_score    integer;
  v_coins    integer;
  v_balance  integer;
begin
  select * into v_session from public.sprint_sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.tg_id <> p_tg_id then raise exception 'NOT_A_PARTICIPANT'; end if;
  if v_session.status = 'completed' then raise exception 'ALREADY_COMPLETED'; end if;

  select count(*), count(*) filter (where is_correct), coalesce(sum(points), 0)
    into v_answered, v_correct, v_score
    from public.sprint_answers where session_id = p_session_id;

  v_coins := v_correct * 3;

  update public.sprint_sessions
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
    'answered',      v_answered,
    'correct',       v_correct,
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
    'public.start_sprint(bigint, integer)',
    'public.answer_sprint(bigint, uuid, integer, smallint)',
    'public.finish_sprint(bigint, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
