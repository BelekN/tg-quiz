-- ============================================================
-- Ежедневный вызов: 5 вопросов, одни и те же для всех игроков в
-- один и тот же день (UTC), без таймера. Один заход в сутки.
--
-- Вопросы выбираются не через order by random(), а детерминированно
-- по дате — тем же приёмом с md5-сидом, что уже используется в
-- shuffle_options/shuffled_correct_index для перемешивания вариантов
-- (см. 021_shuffle_options.sql): сортируем id по
-- md5(current_date || ':' || id) и берём первые 5. Один сид на день
-- даёт всем один и тот же набор, но разный от дня ко дню.
--
-- "Один заход в сутки" защищён на уровне схемы: unique(tg_id, play_date)
-- на daily_sessions, а не отдельной проверкой в коде — это гонкобезопасно
-- при параллельных запросах, в отличие от "check then insert".
-- ============================================================

create table if not exists public.daily_sessions (
  id           uuid primary key default gen_random_uuid(),
  tg_id        bigint  not null references public.users (tg_id) on delete cascade,
  play_date    date    not null default current_date,
  question_ids uuid[]  not null,
  status       text    not null default 'pending' check (status in ('pending', 'completed')),
  score        integer,
  coins_earned integer,
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  unique (tg_id, play_date)
);

create index if not exists daily_sessions_tg_idx
  on public.daily_sessions (tg_id, created_at desc);

create table if not exists public.daily_answers (
  session_id     uuid     not null references public.daily_sessions (id) on delete cascade,
  question_index smallint not null,
  question_id    uuid     not null references public.questions (id),
  answer_index   smallint,          -- null = пропустил / не ответил
  is_correct     boolean  not null,
  points         integer  not null,
  created_at     timestamptz not null default now(),
  primary key (session_id, question_index)
);

alter table public.daily_sessions enable row level security;
alter table public.daily_answers  enable row level security;

-- ------------------------------------------------------------
-- start_daily — сегодняшняя пятёрка вопросов одна на всех. Повторный
-- заход в тот же день падает с уникальным нарушением на (tg_id,
-- play_date) — ловим его отдельно, чтобы вернуть внятный код, а не
-- голую 23505.
-- ------------------------------------------------------------
create or replace function public.start_daily(p_tg_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids       uuid[];
  v_session   public.daily_sessions;
  v_questions jsonb;
begin
  select array_agg(id) into v_ids
    from (
      select id from public.questions
       where is_active
       order by md5(current_date::text || ':' || id::text)
       limit 5
    ) q;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'NOT_ENOUGH_QUESTIONS';
  end if;

  begin
    insert into public.daily_sessions (tg_id, question_ids)
    values (p_tg_id, v_ids)
    returning * into v_session;
  exception when unique_violation then
    raise exception 'ALREADY_PLAYED_TODAY';
  end;

  select jsonb_agg(
           jsonb_build_object(
             'id',       q.id,
             'question', q.question,
             'options',  public.shuffle_options(q.options, v_session.play_date::text || ':' || q.id::text),
             'category', q.category
           ) order by t.ord
         )
    into v_questions
    from unnest(v_session.question_ids) with ordinality as t(qid, ord)
    join public.questions q on q.id = t.qid;

  return jsonb_build_object(
    'session_id', v_session.id,
    'play_date',  v_session.play_date,
    'questions',  v_questions
  );
end $$;

-- ------------------------------------------------------------
-- answer_daily — тот же сид "<play_date>:<question_id>" (не
-- session_id, как в соло/спринте), чтобы порядок вариантов совпадал
-- у всех игроков и не зависел от того, в какой сессии его проверяют.
-- ------------------------------------------------------------
create or replace function public.answer_daily(
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
  v_session        public.daily_sessions;
  v_expected       integer;
  v_qid            uuid;
  v_options        text[];
  v_right          smallint;
  v_shuffled_right smallint;
  v_correct        boolean;
  v_points         integer := 0;
  v_seed           text;
begin
  select * into v_session from public.daily_sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.tg_id <> p_tg_id then raise exception 'NOT_A_PARTICIPANT'; end if;
  if v_session.status = 'completed' then raise exception 'ALREADY_COMPLETED'; end if;

  if p_index < 0 or p_index >= array_length(v_session.question_ids, 1) then
    raise exception 'BAD_QUESTION_INDEX';
  end if;

  select count(*) into v_expected
    from public.daily_answers where session_id = p_session_id;

  if p_index <> v_expected then
    raise exception 'OUT_OF_ORDER_ANSWER';
  end if;

  v_qid := v_session.question_ids[p_index + 1];
  select options, correct_option_index into v_options, v_right
    from public.questions where id = v_qid;

  v_seed := v_session.play_date::text || ':' || v_qid::text;
  v_shuffled_right := public.shuffled_correct_index(v_options, v_seed, v_right);

  v_correct := p_answer is not null and p_answer = v_shuffled_right;
  -- без бонуса за скорость: таймера в этом режиме нет
  if v_correct then v_points := 100; end if;

  insert into public.daily_answers (session_id, question_index, question_id, answer_index, is_correct, points)
  values (p_session_id, p_index, v_qid, p_answer, v_correct, v_points);

  return jsonb_build_object(
    'correct_option_index', v_shuffled_right,
    'is_correct',           v_correct,
    'points',               v_points
  );
end $$;

-- ------------------------------------------------------------
-- finish_daily — итог из daily_answers, монеты как в соло-режиме
-- (5 за верный ответ, без бонусов за победу/ничью — тут не с кем
-- соревноваться напрямую).
-- ------------------------------------------------------------
create or replace function public.finish_daily(
  p_tg_id      bigint,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session  public.daily_sessions;
  v_total    integer;
  v_answered integer;
  v_correct  integer;
  v_score    integer;
  v_coins    integer;
  v_balance  integer;
begin
  select * into v_session from public.daily_sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.tg_id <> p_tg_id then raise exception 'NOT_A_PARTICIPANT'; end if;
  if v_session.status = 'completed' then raise exception 'ALREADY_COMPLETED'; end if;

  v_total := array_length(v_session.question_ids, 1);

  select count(*), count(*) filter (where is_correct), coalesce(sum(points), 0)
    into v_answered, v_correct, v_score
    from public.daily_answers where session_id = p_session_id;

  if v_answered <> v_total then
    raise exception 'INCOMPLETE_SESSION';
  end if;

  v_coins := v_correct * 5;

  update public.daily_sessions
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
    'correct',       v_correct,
    'total',         v_total,
    'score',         v_score,
    'coins_earned',  v_coins,
    'coins_balance', v_balance
  );
end $$;

-- ------------------------------------------------------------
-- get_history — та же функция, что в 022_persona_quizzes.sql, плюс
-- 5-я ветка union all для ежедневного вызова.
-- ------------------------------------------------------------
create or replace function public.get_history(
  p_tg_id bigint,
  p_limit integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  with combined as (
    select
      coalesce(d.completed_at, d.created_at) as happened_at,
      jsonb_build_object(
        'kind',            'duel',
        'id',              d.id,
        'happened_at',     coalesce(d.completed_at, d.created_at),
        'my_score',        ms.my_score,
        'opponent_score',  ms.opp_score,
        'opponent',        case when u.tg_id is not null then jsonb_build_object(
                              'first_name', u.first_name,
                              'username',   u.username,
                              'photo_url',  u.photo_url,
                              'avatar_key', u.avatar_key
                            ) else null end,
        'outcome',         case
                              when ms.opp_score is null then 'pending'
                              when ms.my_score > ms.opp_score then 'win'
                              when ms.my_score < ms.opp_score then 'lose'
                              else 'draw'
                            end
      ) as item
    from public.duels d
    cross join lateral (
      select
        case when d.host_tg_id = p_tg_id then d.host_score  else d.guest_score end as my_score,
        case when d.host_tg_id = p_tg_id then d.guest_score else d.host_score  end as opp_score,
        case when d.host_tg_id = p_tg_id then d.guest_tg_id else d.host_tg_id  end as opp_tg_id
    ) ms
    left join public.users u on u.tg_id = ms.opp_tg_id
    where (d.host_tg_id = p_tg_id and d.host_score is not null)
       or (d.guest_tg_id = p_tg_id and d.guest_score is not null)

    union all

    select
      coalesce(s.completed_at, s.created_at),
      jsonb_build_object(
        'kind',        'solo',
        'id',          s.id,
        'happened_at', coalesce(s.completed_at, s.created_at),
        'category',    s.category,
        'score',       s.score,
        'correct',     (
                         select count(*) from public.solo_answers sa
                          where sa.session_id = s.id and sa.is_correct
                        ),
        'total',       array_length(s.question_ids, 1)
      )
    from public.solo_sessions s
    where s.tg_id = p_tg_id and s.status = 'completed'

    union all

    select
      coalesce(sp.completed_at, sp.started_at),
      jsonb_build_object(
        'kind',        'sprint',
        'id',          sp.id,
        'happened_at', coalesce(sp.completed_at, sp.started_at),
        'score',       sp.score,
        'correct',     (
                         select count(*) from public.sprint_answers pa
                          where pa.session_id = sp.id and pa.is_correct
                        )
      )
    from public.sprint_sessions sp
    where sp.tg_id = p_tg_id and sp.status = 'completed'

    union all

    select
      ps.completed_at,
      jsonb_build_object(
        'kind',        'persona',
        'id',          ps.id,
        'happened_at', ps.completed_at,
        'test_key',    ps.test_key,
        'test_title',  pt.title,
        'result_key',  ps.result_key,
        'result_title', pr.title,
        'icon',        pr.icon
      )
    from public.persona_sessions ps
    join public.persona_tests pt on pt.key = ps.test_key
    join public.persona_results pr on pr.test_key = ps.test_key and pr.key = ps.result_key
    where ps.tg_id = p_tg_id and ps.completed_at is not null

    union all

    select
      d.completed_at,
      jsonb_build_object(
        'kind',        'daily',
        'id',          d.id,
        'happened_at', d.completed_at,
        'score',       d.score,
        'correct',     (
                         select count(*) from public.daily_answers da
                          where da.session_id = d.id and da.is_correct
                        ),
        'total',       array_length(d.question_ids, 1)
      )
    from public.daily_sessions d
    where d.tg_id = p_tg_id and d.status = 'completed'
  ),
  limited as (
    select happened_at, item from combined order by happened_at desc limit p_limit
  )
  select coalesce(jsonb_agg(item order by happened_at desc), '[]'::jsonb)
    into v_result
    from limited;

  return v_result;
end $$;

-- ------------------------------------------------------------
-- Права: только service_role, как и весь остальной API.
-- ------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.start_daily(bigint)',
    'public.answer_daily(bigint, uuid, integer, smallint)',
    'public.finish_daily(bigint, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
