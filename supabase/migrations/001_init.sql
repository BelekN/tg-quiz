-- ============================================================
-- TG Quiz — Фаза 1 «Дуэль с друзьями»
-- Запускать целиком в Supabase SQL Editor.
-- Идемпотентен: можно прогонять повторно.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. USERS
-- ------------------------------------------------------------
-- tg_id — ИМЕННО bigint: Telegram ID уже вышел за пределы int4
-- (> 2 147 483 647), с integer новые аккаунты будут падать.
create table if not exists public.users (
  id           uuid primary key default gen_random_uuid(),
  tg_id        bigint      not null unique,
  username     text,
  first_name   text,
  photo_url    text,
  total_score  integer     not null default 0 check (total_score >= 0),
  coins        integer     not null default 0 check (coins >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. QUESTIONS
-- ------------------------------------------------------------
create table if not exists public.questions (
  id                   uuid primary key default gen_random_uuid(),
  question             text        not null,
  options              text[]      not null,
  correct_option_index smallint    not null,
  category             text        not null default 'general',
  is_active            boolean     not null default true,
  created_at           timestamptz not null default now(),

  -- защита от битого контента: индекс правильного ответа
  -- обязан существовать внутри массива options
  constraint questions_options_len
    check (array_length(options, 1) between 2 and 6),
  constraint questions_correct_index_in_range
    check (correct_option_index >= 0
           and correct_option_index < array_length(options, 1))
);

create index if not exists questions_category_idx
  on public.questions (category) where is_active;

-- ------------------------------------------------------------
-- 3. DUELS
-- ------------------------------------------------------------
do $$ begin
  create type public.duel_status as enum ('pending', 'completed');
exception when duplicate_object then null; end $$;

create table if not exists public.duels (
  id            uuid primary key default gen_random_uuid(),
  host_tg_id    bigint  not null references public.users (tg_id) on delete cascade,
  guest_tg_id   bigint           references public.users (tg_id) on delete set null,
  host_score    integer,
  guest_score   integer,
  -- фиксируем набор вопросов на дуэль: гость обязан играть
  -- ТОТ ЖЕ набор, иначе сравнение очков бессмысленно
  question_ids  uuid[]  not null,
  status        public.duel_status not null default 'pending',
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,

  constraint duels_guest_is_not_host
    check (guest_tg_id is null or guest_tg_id <> host_tg_id),
  constraint duels_completed_is_consistent
    check (
      status <> 'completed'
      or (guest_tg_id is not null
          and host_score is not null
          and guest_score is not null
          and completed_at is not null)
    )
);

create index if not exists duels_host_idx  on public.duels (host_tg_id, created_at desc);
create index if not exists duels_guest_idx on public.duels (guest_tg_id, created_at desc);

-- ------------------------------------------------------------
-- 4. DUEL_ANSWERS — по одной строке на (игрок, вопрос)
-- ------------------------------------------------------------
-- Зачем отдельная таблица, хотя в ТЗ её не было:
-- клиенту нужен «зелёный/красный» сразу после тапа, значит
-- правильный ответ надо ему отдать. Отдаём ТОЛЬКО после того,
-- как выбор игрока уже записан здесь — и только на текущий
-- вопрос. Так подсмотреть ответы заранее физически нельзя.
create table if not exists public.duel_answers (
  duel_id        uuid     not null references public.duels (id) on delete cascade,
  tg_id          bigint   not null references public.users (tg_id) on delete cascade,
  question_index smallint not null,
  question_id    uuid     not null references public.questions (id),
  answer_index   smallint,          -- null = время вышло
  is_correct     boolean  not null,
  elapsed_ms     integer  not null,
  points         integer  not null,
  created_at     timestamptz not null default now(),
  primary key (duel_id, tg_id, question_index)
);

-- ------------------------------------------------------------
-- 5. RLS: закрываем всё наглухо
-- ------------------------------------------------------------
-- RLS включён, политик НЕТ => для anon/authenticated доступ
-- полностью запрещён. Весь трафик идёт через Edge Function
-- на service_role, который RLS обходит. Так клиент физически
-- не может ни подделать очки, ни вычитать correct_option_index.
alter table public.users        enable row level security;
alter table public.questions    enable row level security;
alter table public.duels        enable row level security;
alter table public.duel_answers enable row level security;

-- ------------------------------------------------------------
-- 6. upsert_user — вход в приложение
-- ------------------------------------------------------------
create or replace function public.upsert_user(
  p_tg_id      bigint,
  p_username   text default null,
  p_first_name text default null,
  p_photo_url  text default null
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare v_user public.users;
begin
  insert into public.users as u (tg_id, username, first_name, photo_url)
  values (p_tg_id, p_username, p_first_name, p_photo_url)
  on conflict (tg_id) do update
    set username   = coalesce(excluded.username,   u.username),
        first_name = coalesce(excluded.first_name, u.first_name),
        photo_url  = coalesce(excluded.photo_url,  u.photo_url),
        updated_at = now()
  returning * into v_user;

  return v_user;
end $$;

-- ------------------------------------------------------------
-- 7. start_duel — создать дуэль или присоединиться к чужой
-- ------------------------------------------------------------
-- Возвращает вопросы БЕЗ correct_option_index.
-- p_duel_id = null  -> хост создаёт новую дуэль
-- p_duel_id = uuid  -> гость входит по ссылке ?startapp=duel_<uuid>
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
    -- ---- ГОСТЬ входит по ссылке ----
    select * into v_duel from public.duels where id = p_duel_id for update;
    if not found then
      raise exception 'DUEL_NOT_FOUND';
    end if;

    if v_duel.host_tg_id = p_tg_id then
      -- хост тыкнул в собственную ссылку — переигрывать нельзя
      raise exception 'DUEL_IS_YOURS';
    end if;

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

-- ------------------------------------------------------------
-- 8. answer_question — записать ответ и вернуть правильный
-- ------------------------------------------------------------
-- Ключевая защита: p_index обязан быть СЛЕДУЮЩИМ по счёту.
-- Нельзя запросить 5-й вопрос, не ответив на 1..4, значит
-- нельзя собрать все правильные ответы до начала игры.
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
  v_right    smallint;
  v_correct  boolean;
  v_elapsed  integer;
  v_points   integer := 0;
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
  select correct_option_index into v_right
    from public.questions where id = v_qid;

  -- времени доверяем ограниченно: клампим в [0, 10000]
  v_elapsed := least(greatest(coalesce(p_elapsed_ms, 10000), 0), 10000);
  v_correct := p_answer is not null and p_answer = v_right;

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
    'correct_option_index', v_right,
    'is_correct',           v_correct,
    'points',               v_points
  );
end $$;

-- ------------------------------------------------------------
-- 9. finish_duel — итог считается ИЗ БАЗЫ, не из запроса
-- ------------------------------------------------------------
-- Клиент не присылает ни очков, ни ответов: всё уже лежит
-- в duel_answers, записанное answer_question.
create or replace function public.finish_duel(
  p_tg_id   bigint,
  p_duel_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel     public.duels;
  v_role     text;
  v_total    integer;
  v_answered integer;
  v_correct  integer;
  v_score    integer;
  v_coins    integer;
  v_balance  integer;
  v_opponent integer;
  v_rival_id bigint;
  v_outcome  text := 'pending';
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then
    raise exception 'DUEL_NOT_FOUND';
  end if;

  if p_tg_id = v_duel.host_tg_id then
    v_role := 'host';
    if v_duel.host_score is not null then raise exception 'ALREADY_PLAYED'; end if;
  elsif p_tg_id = v_duel.guest_tg_id then
    v_role := 'guest';
    if v_duel.guest_score is not null then raise exception 'ALREADY_PLAYED'; end if;
  else
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  v_total := array_length(v_duel.question_ids, 1);

  select count(*),
         count(*) filter (where is_correct),
         coalesce(sum(points), 0)
    into v_answered, v_correct, v_score
    from public.duel_answers
   where duel_id = p_duel_id and tg_id = p_tg_id;

  if v_answered <> v_total then
    raise exception 'INCOMPLETE_DUEL';
  end if;

  v_coins := v_correct * 5;

  if v_role = 'host' then
    v_opponent := v_duel.guest_score;
    update public.duels set host_score = v_score where id = v_duel.id;
  else
    v_opponent := v_duel.host_score;
    update public.duels set guest_score = v_score where id = v_duel.id;
  end if;

  -- Мы доиграли вторыми -> исход дуэли определён.
  if v_opponent is not null then
    v_outcome := case
                   when v_score > v_opponent then 'win'
                   when v_score < v_opponent then 'lose'
                   else 'draw'
                 end;

    if v_outcome = 'win'  then v_coins := v_coins + 20; end if;
    if v_outcome = 'draw' then v_coins := v_coins + 10; end if;

    -- Соперник финишировал ПЕРВЫМ, когда исход был ещё неизвестен,
    -- и бонуса не получил. Доначисляем его здесь, иначе победа
    -- первого игрока не оплачивается вообще никогда.
    v_rival_id := case when v_role = 'host'
                       then v_duel.guest_tg_id
                       else v_duel.host_tg_id end;

    if v_outcome = 'lose' then
      update public.users set coins = coins + 20, updated_at = now()
       where tg_id = v_rival_id;
    elsif v_outcome = 'draw' then
      update public.users set coins = coins + 10, updated_at = now()
       where tg_id = v_rival_id;
    end if;

    update public.duels
       set status = 'completed', completed_at = now()
     where id = v_duel.id;
  end if;

  update public.users
     set total_score = total_score + v_score,
         coins       = coins + v_coins,
         updated_at  = now()
   where tg_id = p_tg_id
  returning coins into v_balance;

  return jsonb_build_object(
    'duel_id',        v_duel.id,
    'role',           v_role,
    'correct',        v_correct,
    'total',          v_total,
    'score',          v_score,
    'coins_earned',   v_coins,
    'coins_balance',  v_balance,
    'opponent_score', v_opponent,
    'outcome',        v_outcome
  );
end $$;

-- ------------------------------------------------------------
-- 10. Права: RPC доступны только service_role
-- ------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.upsert_user(bigint, text, text, text)',
    'public.start_duel(bigint, uuid, integer)',
    'public.answer_question(bigint, uuid, integer, smallint, integer)',
    'public.finish_duel(bigint, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 11. Сид вопросов (нужно минимум 5, иначе дуэль не стартует)
-- ------------------------------------------------------------
insert into public.questions (question, options, correct_option_index, category)
select * from (values
  ('Столица Австралии?',                    array['Сидней','Канберра','Мельбурн','Перт'],        1::smallint, 'geo'),
  ('Сколько костей у взрослого человека?',  array['206','256','180','300'],                      0::smallint, 'science'),
  ('Кто написал «Мастера и Маргариту»?',    array['Гоголь','Булгаков','Достоевский','Чехов'],    1::smallint, 'culture'),
  ('Какой океан самый большой?',            array['Атлантический','Тихий','Индийский','Северный Ледовитый'], 1::smallint, 'geo'),
  ('В каком году вышел первый iPhone?',     array['2005','2006','2007','2008'],                  2::smallint, 'tech'),
  ('Химический символ золота?',             array['Ag','Au','Fe','Gd'],                          1::smallint, 'science'),
  ('Сколько игроков одной команды на поле в футболе?', array['10','11','12','9'],                1::smallint, 'sport'),
  ('Какая планета ближе всего к Солнцу?',   array['Венера','Меркурий','Марс','Земля'],           1::smallint, 'science'),
  ('Кто основал Telegram?',                 array['Цукерберг','Дуров','Маск','Брин'],            1::smallint, 'tech'),
  ('Сколько цветов в радуге (традиционно)?',array['5','6','7','8'],                              2::smallint, 'general')
) as v(question, options, correct_option_index, category)
where not exists (select 1 from public.questions);
