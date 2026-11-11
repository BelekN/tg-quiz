-- ============================================================
-- Раздел «ПДД» во вкладке «Учёба»: самопроверка по ПДД КР.
--
-- Два режима:
--   • тренировка по теме — все вопросы темы с ответами и объяснениями
--     сразу (это обучение: мгновенная обратная связь важнее, наград
--     нет, накручивать нечего). Клиент присылает итог раунда только
--     для прогресса по теме;
--   • экзамен — как теоретический экзамен в КР: 20 вопросов из всех
--     тем, 25 минут, не больше 2 ошибок. Ответы проверяет сервер,
--     время тоже считает сервер (от started_at). Монет и очков нет,
--     поэтому после экзамена разбор показываем полностью — с
--     правильными ответами и объяснениями.
--
-- Контент — не здесь, а в supabase/pdd/questions.sql (генерируется из
-- questions.json, см. scripts/build-pdd-sql.mjs).
-- ============================================================

create table if not exists public.pdd_topics (
  key        text primary key,
  title      text not null,
  icon       text not null default '🚗',
  ord        integer not null default 0,
  in_exam    boolean not null default true,         -- false: только тренировка (например, «Штрафы» — это КоП, не ПДД)
  is_active  boolean not null default true
);

create table if not exists public.pdd_questions (
  id         text primary key,
  topic_key  text not null references public.pdd_topics(key),
  question   text not null,
  sign       text,                                  -- код знака для PddSign.jsx, например '3.24:40'
  options    jsonb not null,                        -- ["…", "…"] в исходном порядке
  answer     integer not null,                      -- индекс в options
  explain    text not null default '',
  ord        integer not null default 0,
  is_active  boolean not null default true,
  check (jsonb_typeof(options) = 'array'),
  check (answer >= 0 and answer < jsonb_array_length(options))
);

create index if not exists pdd_questions_topic_idx on public.pdd_questions (topic_key) where is_active;

create table if not exists public.pdd_topic_progress (
  tg_id         bigint not null references public.users(tg_id) on delete cascade,
  topic_key     text not null references public.pdd_topics(key) on delete cascade,
  attempts      integer not null default 0,
  best_correct  integer not null default 0,
  last_correct  integer not null default 0,
  last_total    integer not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (tg_id, topic_key)
);

create table if not exists public.pdd_exams (
  id            bigint generated always as identity primary key,
  tg_id         bigint not null references public.users(tg_id) on delete cascade,
  question_ids  text[] not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  correct       integer,
  passed        boolean,
  timed_out     boolean not null default false
);

create index if not exists pdd_exams_user_idx on public.pdd_exams (tg_id, finished_at desc);

-- Тот же режим, что у остальных таблиц: RLS без политик + явный revoke.
alter table public.pdd_topics         enable row level security;
alter table public.pdd_questions      enable row level security;
alter table public.pdd_topic_progress enable row level security;
alter table public.pdd_exams          enable row level security;

revoke all on public.pdd_topics, public.pdd_questions, public.pdd_topic_progress, public.pdd_exams
  from anon, authenticated;

-- ------------------------------------------------------------
-- Правила экзамена — одно место, его же отдаём клиенту.
-- ------------------------------------------------------------
create or replace function public.pdd_exam_rules()
returns jsonb
language sql
immutable
set search_path = public
as $$
  select '{"questions": 20, "minutes": 25, "max_errors": 2}'::jsonb;
$$;

revoke all on function public.pdd_exam_rules() from public, anon, authenticated;
grant execute on function public.pdd_exam_rules() to service_role;

-- ------------------------------------------------------------
-- Экран раздела: правила и статистика экзамена + темы с прогрессом.
-- ------------------------------------------------------------
create or replace function public.get_pdd(p_tg_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'exam', public.pdd_exam_rules() || jsonb_build_object(
      'taken',  (select count(*) from public.pdd_exams e where e.tg_id = p_tg_id and e.finished_at is not null),
      'passed', (select count(*) from public.pdd_exams e where e.tg_id = p_tg_id and e.passed),
      'best',   (select max(e.correct) from public.pdd_exams e
                  where e.tg_id = p_tg_id and e.finished_at is not null and not e.timed_out),
      'last',   (select jsonb_build_object(
                          'correct',     e.correct,
                          'total',       cardinality(e.question_ids),
                          'passed',      e.passed,
                          'timed_out',   e.timed_out,
                          'finished_at', e.finished_at)
                   from public.pdd_exams e
                  where e.tg_id = p_tg_id and e.finished_at is not null
                  order by e.finished_at desc
                  limit 1)
    ),
    'topics', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'key',          t.key,
               'title',        t.title,
               'icon',         t.icon,
               'in_exam',      t.in_exam,
               'total',        (select count(*) from public.pdd_questions q where q.topic_key = t.key and q.is_active),
               'attempts',     coalesce(p.attempts, 0),
               'best_correct', coalesce(p.best_correct, 0),
               'last_correct', p.last_correct,
               'last_total',   p.last_total
             ) order by t.ord), '[]'::jsonb)
        from public.pdd_topics t
        left join public.pdd_topic_progress p on p.topic_key = t.key and p.tg_id = p_tg_id
       where t.is_active
    )
  );
$$;

revoke all on function public.get_pdd(bigint) from public, anon, authenticated;
grant execute on function public.get_pdd(bigint) to service_role;

-- ------------------------------------------------------------
-- Тренировка: все вопросы темы в случайном порядке, сразу с ответами.
-- ------------------------------------------------------------
create or replace function public.start_pdd_training(p_tg_id bigint, p_topic_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_topic public.pdd_topics;
begin
  select * into v_topic from public.pdd_topics where key = p_topic_key and is_active;
  if not found then
    raise exception 'PDD_TOPIC_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'topic', jsonb_build_object('key', v_topic.key, 'title', v_topic.title, 'icon', v_topic.icon),
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id',       q.id,
               'question', q.question,
               'sign',     q.sign,
               'options',  q.options,
               'answer',   q.answer,
               'explain',  q.explain
             ) order by random()), '[]'::jsonb)
        from public.pdd_questions q
       where q.topic_key = v_topic.key and q.is_active
    )
  );
end $$;

revoke all on function public.start_pdd_training(bigint, text) from public, anon, authenticated;
grant execute on function public.start_pdd_training(bigint, text) to service_role;

-- Итог раунда тренировки — только для прогресса по теме. Цифры приходят
-- с клиента, поэтому клампим к реальному числу вопросов темы.
create or replace function public.finish_pdd_training(
  p_tg_id bigint, p_topic_key text, p_correct integer, p_total integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max     integer;
  v_total   integer;
  v_correct integer;
  v_row     public.pdd_topic_progress;
begin
  select count(*) into v_max
    from public.pdd_questions q
    join public.pdd_topics t on t.key = q.topic_key
   where q.topic_key = p_topic_key and q.is_active and t.is_active;
  if v_max = 0 then
    raise exception 'PDD_TOPIC_NOT_FOUND';
  end if;

  v_total   := least(greatest(coalesce(p_total, 0), 0), v_max);
  v_correct := least(greatest(coalesce(p_correct, 0), 0), v_total);

  insert into public.pdd_topic_progress as p (tg_id, topic_key, attempts, best_correct, last_correct, last_total)
  values (p_tg_id, p_topic_key, 1, v_correct, v_correct, v_total)
  on conflict (tg_id, topic_key) do update set
    attempts     = p.attempts + 1,
    best_correct = greatest(p.best_correct, excluded.best_correct),
    last_correct = excluded.last_correct,
    last_total   = excluded.last_total,
    updated_at   = now()
  returning * into v_row;

  return jsonb_build_object(
    'correct',      v_correct,
    'total',        v_total,
    'best_correct', v_row.best_correct,
    'topic_total',  v_max
  );
end $$;

revoke all on function public.finish_pdd_training(bigint, text, integer, integer) from public, anon, authenticated;
grant execute on function public.finish_pdd_training(bigint, text, integer, integer) to service_role;

-- ------------------------------------------------------------
-- Экзамен: 20 вопросов вразброс по темам с in_exam (сначала по одному из каждой
-- темы, потом по второму и т.д.), без ответов. Незаконченные попытки
-- этого игрока выбрасываем — одновременно идёт только один экзамен,
-- и брошенные попытки не копятся в таблице.
-- ------------------------------------------------------------
create or replace function public.start_pdd_exam(p_tg_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rules  jsonb := public.pdd_exam_rules();
  v_n      integer := (v_rules ->> 'questions')::int;
  v_ids    text[];
  v_exam   public.pdd_exams;
begin
  select array_agg(id order by random()) into v_ids
    from (
      select q.id
        from (
          select q.id, row_number() over (partition by q.topic_key order by random()) as rn
            from public.pdd_questions q
            join public.pdd_topics t on t.key = q.topic_key
           where q.is_active and t.is_active and t.in_exam
        ) q
       order by q.rn, random()
       limit v_n
    ) picked;

  if coalesce(cardinality(v_ids), 0) < v_n then
    raise exception 'NOT_ENOUGH_QUESTIONS';
  end if;

  delete from public.pdd_exams where tg_id = p_tg_id and finished_at is null;

  insert into public.pdd_exams (tg_id, question_ids)
  values (p_tg_id, v_ids)
  returning * into v_exam;

  return v_rules || jsonb_build_object(
    'exam_id',    v_exam.id,
    'started_at', v_exam.started_at,
    'questions', (
      select jsonb_agg(jsonb_build_object(
               'id',       q.id,
               'question', q.question,
               'sign',     q.sign,
               'options',  q.options
             ) order by x.n)
        from unnest(v_ids) with ordinality as x(id, n)
        join public.pdd_questions q on q.id = x.id
    )
  );
end $$;

revoke all on function public.start_pdd_exam(bigint) from public, anon, authenticated;
grant execute on function public.start_pdd_exam(bigint) to service_role;

-- Сдать экзамен. p_answers — индексы вариантов в ИСХОДНОМ порядке
-- options (клиент перемешивает показ сам и переводит обратно), -1 —
-- нет ответа. Опоздание сверх 25 минут (минута запаса на сеть) — не
-- сдан, как на настоящем экзамене, но разбор всё равно показываем.
create or replace function public.finish_pdd_exam(p_tg_id bigint, p_exam_id bigint, p_answers integer[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rules     jsonb := public.pdd_exam_rules();
  v_exam      public.pdd_exams;
  v_total     integer;
  v_correct   integer;
  v_timed_out boolean;
  v_passed    boolean;
  v_review    jsonb;
begin
  select * into v_exam from public.pdd_exams
   where id = p_exam_id and tg_id = p_tg_id
   for update;
  if not found then
    raise exception 'PDD_EXAM_NOT_FOUND';
  end if;
  if v_exam.finished_at is not null then
    raise exception 'PDD_EXAM_FINISHED';
  end if;

  v_total := cardinality(v_exam.question_ids);
  if p_answers is null or coalesce(cardinality(p_answers), 0) <> v_total then
    raise exception 'INVALID_EXAM_ANSWERS';
  end if;

  with graded as (
    select x.n,
           q.id,
           coalesce(p_answers[x.n], -1) as picked,
           q.answer,
           q.explain,
           coalesce(p_answers[x.n], -1) = q.answer as ok
      from unnest(v_exam.question_ids) with ordinality as x(id, n)
      join public.pdd_questions q on q.id = x.id
  )
  select count(*) filter (where ok),
         jsonb_agg(jsonb_build_object(
           'id',      id,
           'picked',  picked,
           'answer',  answer,
           'correct', ok,
           'explain', explain
         ) order by n)
    into v_correct, v_review
    from graded;

  v_timed_out := now() > v_exam.started_at + make_interval(mins => (v_rules ->> 'minutes')::int + 1);
  v_passed := not v_timed_out and (v_total - v_correct) <= (v_rules ->> 'max_errors')::int;

  update public.pdd_exams
     set finished_at = now(),
         correct     = v_correct,
         passed      = v_passed,
         timed_out   = v_timed_out
   where id = v_exam.id;

  return v_rules || jsonb_build_object(
    'correct',   v_correct,
    'total',     v_total,
    'passed',    v_passed,
    'timed_out', v_timed_out,
    'review',    v_review
  );
end $$;

revoke all on function public.finish_pdd_exam(bigint, bigint, integer[]) from public, anon, authenticated;
grant execute on function public.finish_pdd_exam(bigint, bigint, integer[]) to service_role;
