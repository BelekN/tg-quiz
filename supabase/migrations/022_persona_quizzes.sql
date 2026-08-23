-- ============================================================
-- "Кто ты из..." — отдельный режим, не про правильные ответы, а про
-- накопление "черт" и выдачу одного из готовых результатов с красивой
-- карточкой для шеринга в Stories (уже есть shareResultToStory).
--
-- Принципиально другая модель по сравнению с дуэлью/соло/спринтом:
-- здесь нет correct_option_index и нет очков/монет — варианты ответа
-- сразу отдаются клиенту целиком (скрывать нечего, подделывать
-- результат смысла не имеет: на баланс/лидерборд он не влияет), а
-- финальный result_key вычисляется НА КЛИЕНТЕ и просто валидируется
-- сервером против каталога перед сохранением в историю.
--
-- Два типа скоринга (persona_tests.scoring):
--   'categorical' — каждый вариант ведёт к своему result_key,
--                    выигрывает тот, что выбрали чаще всего
--                    (пример: "Какой ты разработчик?").
--   'scale'       — у каждого варианта числовое value, финальный
--                    result_key — тот, в чей [min_score, max_score]
--                    попадает сумма (пример: "Уровень выгорания").
-- ============================================================

create table if not exists public.persona_tests (
  key         text primary key,
  title       text not null,
  description text not null,
  icon        text not null,
  scoring     text not null check (scoring in ('categorical', 'scale')),
  ord         integer not null default 0
);

create table if not exists public.persona_questions (
  id       uuid primary key default gen_random_uuid(),
  test_key text not null references public.persona_tests (key) on delete cascade,
  ord      integer not null,
  question text not null,
  unique (test_key, ord)
);

create table if not exists public.persona_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.persona_questions (id) on delete cascade,
  ord         integer not null,
  label       text not null,
  result_key  text,     -- для scoring = 'categorical'
  value       integer,  -- для scoring = 'scale'
  unique (question_id, ord)
);

create table if not exists public.persona_results (
  test_key    text not null references public.persona_tests (key) on delete cascade,
  key         text not null,
  title       text not null,
  description text not null,
  icon        text not null,
  min_score   integer,  -- для scoring = 'scale'
  max_score   integer,  -- для scoring = 'scale'
  ord         integer not null default 0,
  primary key (test_key, key)
);

create table if not exists public.persona_sessions (
  id           uuid primary key default gen_random_uuid(),
  tg_id        bigint not null references public.users (tg_id) on delete cascade,
  test_key     text not null references public.persona_tests (key),
  result_key   text,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists persona_sessions_tg_idx
  on public.persona_sessions (tg_id, created_at desc);

alter table public.persona_tests     enable row level security;
alter table public.persona_questions enable row level security;
alter table public.persona_options   enable row level security;
alter table public.persona_results   enable row level security;
alter table public.persona_sessions  enable row level security;

revoke all on table public.persona_tests, public.persona_questions, public.persona_options,
  public.persona_results, public.persona_sessions
  from public, anon, authenticated;

-- ------------------------------------------------------------
-- get_persona_tests — каталог тестов для списка на клиенте
-- ------------------------------------------------------------
create or replace function public.get_persona_tests()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'key', key, 'title', title, 'description', description, 'icon', icon
         ) order by ord), '[]'::jsonb)
    from public.persona_tests;
$$;

-- ------------------------------------------------------------
-- start_persona — все вопросы теста целиком, вместе с вариантами.
-- Ничего не скрываем: result_key/value у опций отдаются сразу,
-- подсчёт идёт на клиенте (нет ни правильных ответов, ни ставок).
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
                        ) order by o.ord
                      )
                 from public.persona_options o
                where o.question_id = q.id
             )
           ) order by q.ord
         )
    into v_questions
    from public.persona_questions q
   where q.test_key = p_test_key;

  -- Нужно клиенту, чтобы вычислить result_key самостоятельно:
  -- для categorical он и так есть в каждой опции, но для scale — только
  -- диапазоны очков здесь и говорят, в какой result_key попадёт сумма.
  -- Секрета тут нет (ставок на исход нет), поэтому просто отдаём каталог.
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

-- ------------------------------------------------------------
-- finish_persona — клиент прислал итоговый result_key (сам его
-- посчитал по scoring теста); сервер только проверяет, что такой
-- результат существует у ЭТОГО теста, и отдаёт карточку для показа/
-- шеринга. Экономику (очки/монеты) не трогаем — тест только для фана.
-- ------------------------------------------------------------
create or replace function public.finish_persona(
  p_tg_id      bigint,
  p_session_id uuid,
  p_result_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.persona_sessions;
  v_result  public.persona_results;
begin
  select * into v_session from public.persona_sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.tg_id <> p_tg_id then raise exception 'NOT_A_PARTICIPANT'; end if;
  if v_session.completed_at is not null then raise exception 'ALREADY_COMPLETED'; end if;

  select * into v_result from public.persona_results
   where test_key = v_session.test_key and key = p_result_key;
  if not found then
    raise exception 'BAD_RESULT_KEY';
  end if;

  update public.persona_sessions
     set result_key = p_result_key, completed_at = now()
   where id = p_session_id;

  return jsonb_build_object(
    'test_key',    v_session.test_key,
    'key',         v_result.key,
    'title',       v_result.title,
    'description', v_result.description,
    'icon',        v_result.icon
  );
end $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.get_persona_tests()',
    'public.start_persona(bigint, text)',
    'public.finish_persona(bigint, uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- ------------------------------------------------------------
-- get_history — добавляем персональные тесты как 4-й вид записи.
-- Та же функция, что в 015_history.sql, плюс один union all.
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
  ),
  limited as (
    select happened_at, item from combined order by happened_at desc limit p_limit
  )
  select coalesce(jsonb_agg(item order by happened_at desc), '[]'::jsonb)
    into v_result
    from limited;

  return v_result;
end $$;
