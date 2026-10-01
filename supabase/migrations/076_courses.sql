-- ============================================================
-- Раздел «Учёба»: мини-курсы по 3–5 минут в день, 7 дней.
--
-- День = фаза A (теория: переписки + карточки) и фаза B (закрепление:
-- упражнения по новому + повторение старого). В конце дня игрок
-- оценивает каждую карточку: «забыл» / «с трудом» / «легко» — это
-- простой Лейтнер: оценка решает, на какой день курса карточка
-- вернётся в повторение (forgot → завтра, hard → через день, easy →
-- через 4 дня, то есть до конца курса скорее всего уже не вернётся).
-- Последний день — повторение + итоговый тест, его проверяет сервер
-- (ответы в courses.exam_key наружу не уходят); сдал — сертификат.
--
-- Один день курса — один календарный день (UTC, как у ежедневного
-- вызова в 033_daily_challenge.sql): прошёл день N сегодня — день N+1
-- откроется завтра. Пропуск дней ничего не сбрасывает, курс просто
-- ждёт.
--
-- Контент — не здесь, а в supabase/courses/<key>.sql (генерируется
-- из одноимённого .json, см. scripts/build-course-sql.mjs), тот же
-- принцип, что у supabase/questions/bank.sql: миграция — схема и RPC.
--
-- Ответы на упражнения практики приходят клиенту вместе с днём — это
-- обучение, а не соревнование, мгновенная обратная связь важнее. За
-- день начисляется фиксированная награда один раз, накручивать нечего.
-- ============================================================

create table if not exists public.courses (
  key          text primary key,
  title        text not null,
  subtitle     text not null default '',
  description  text not null default '',
  icon         text not null default '📚',
  total_days   integer not null check (total_days between 1 and 30),
  pass_score   integer not null check (pass_score >= 0),
  exam         jsonb not null default '[]'::jsonb,  -- [{id, quote, options}] — без ответов
  exam_key     jsonb not null default '[]'::jsonb,  -- [{answer, explain}] — только после сдачи
  ord          integer not null default 0,
  is_active    boolean not null default true
);

create table if not exists public.course_cards (
  course_key  text not null references public.courses(key) on delete cascade,
  card_key    text not null,
  title       text not null,
  icon        text not null default '',
  summary     text not null default '',
  intro_day   integer not null,
  review      jsonb not null default '[]'::jsonb,  -- упражнения для повторения, по кругу
  ord         integer not null default 0,
  primary key (course_key, card_key)
);

create table if not exists public.course_days (
  course_key  text not null references public.courses(key) on delete cascade,
  day         integer not null,
  title       text not null,
  subtitle    text not null default '',
  cards       text[] not null default '{}',        -- какие карточки вводит этот день
  theory      jsonb not null default '[]'::jsonb,  -- фаза A
  practice    jsonb not null default '[]'::jsonb,  -- фаза B (без повторения — его подбирает сервер)
  primary key (course_key, day)
);

create table if not exists public.course_enrollments (
  tg_id              bigint not null references public.users(tg_id) on delete cascade,
  course_key         text not null references public.courses(key) on delete cascade,
  started_at         timestamptz not null default now(),
  days_done          integer not null default 0,
  last_completed_on  date,
  exam_attempts      integer not null default 0,
  exam_best          integer,
  completed_at       timestamptz,
  certificate_no     bigint unique,
  nudged_on          date,  -- последний пуш «день курса ждёт», не чаще раза в сутки
  primary key (tg_id, course_key)
);

create table if not exists public.course_day_completions (
  tg_id         bigint not null,
  course_key    text not null,
  day           integer not null,
  correct       integer not null default 0,
  total         integer not null default 0,
  completed_at  timestamptz not null default now(),
  primary key (tg_id, course_key, day),
  foreign key (tg_id, course_key) references public.course_enrollments(tg_id, course_key) on delete cascade
);

create table if not exists public.course_card_progress (
  tg_id        bigint not null,
  course_key   text not null,
  card_key     text not null,
  box          smallint not null check (box between 1 and 3),
  due_day      integer not null,  -- день КУРСА (не календарь), с которого карточка снова в повторении
  reviews      integer not null default 0,
  last_rating  text not null check (last_rating in ('forgot', 'hard', 'easy')),
  updated_at   timestamptz not null default now(),
  primary key (tg_id, course_key, card_key),
  foreign key (tg_id, course_key) references public.course_enrollments(tg_id, course_key) on delete cascade
);

create sequence if not exists public.course_certificate_seq;

-- Тот же режим, что у остальных таблиц: RLS без политик + явный revoke
-- (второй рубеж, см. 041_security_hardening.sql и 073_referrals_rls.sql).
alter table public.courses                enable row level security;
alter table public.course_cards           enable row level security;
alter table public.course_days            enable row level security;
alter table public.course_enrollments     enable row level security;
alter table public.course_day_completions enable row level security;
alter table public.course_card_progress   enable row level security;

revoke all on public.courses, public.course_cards, public.course_days,
              public.course_enrollments, public.course_day_completions,
              public.course_card_progress
  from anon, authenticated;
revoke all on sequence public.course_certificate_seq from anon, authenticated;

-- ------------------------------------------------------------
-- Сертификат — один и тот же объект в complete_course_day (сразу после
-- сдачи) и get_course (когда заходишь посмотреть его позже).
-- ------------------------------------------------------------
create or replace function public.course_certificate_json(p_tg_id bigint, p_course_key text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'no',           e.certificate_no,
           'name',         coalesce(nullif(u.first_name, ''), u.username, 'Игрок'),
           'course_title', c.title,
           'issued_on',    (e.completed_at at time zone 'UTC')::date,
           'score',        e.exam_best,
           'exam_total',   jsonb_array_length(c.exam),
           'total_days',   c.total_days,
           'cards_count',  (select count(*) from public.course_cards cc where cc.course_key = c.key)
         )
    from public.course_enrollments e
    join public.courses c on c.key = e.course_key
    join public.users u on u.tg_id = e.tg_id
   where e.tg_id = p_tg_id and e.course_key = p_course_key and e.completed_at is not null;
$$;

revoke all on function public.course_certificate_json(bigint, text) from public, anon, authenticated;
grant execute on function public.course_certificate_json(bigint, text) to service_role;

-- ------------------------------------------------------------
-- Каталог для вкладки «Учёба».
-- ------------------------------------------------------------
create or replace function public.get_courses(p_tg_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'key',             c.key,
           'title',           c.title,
           'subtitle',        c.subtitle,
           'description',     c.description,
           'icon',            c.icon,
           'total_days',      c.total_days,
           'days_done',       coalesce(e.days_done, 0),
           'started',         e.tg_id is not null,
           'completed',       e.completed_at is not null,
           'available_today', e.completed_at is null
                              and (e.last_completed_on is null or e.last_completed_on < current_date)
         ) order by c.ord), '[]'::jsonb)
    from public.courses c
    left join public.course_enrollments e on e.course_key = c.key and e.tg_id = p_tg_id
   where c.is_active;
$$;

revoke all on function public.get_courses(bigint) from public, anon, authenticated;
grant execute on function public.get_courses(bigint) to service_role;

-- ------------------------------------------------------------
-- Экран курса: дорожка из дней + шпаргалка по уже изученным карточкам.
-- ------------------------------------------------------------
create or replace function public.get_course(p_tg_id bigint, p_course_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_course public.courses;
  v_enr    public.course_enrollments;
begin
  select * into v_course from public.courses where key = p_course_key and is_active;
  if not found then
    raise exception 'COURSE_NOT_FOUND';
  end if;

  select * into v_enr from public.course_enrollments
   where tg_id = p_tg_id and course_key = p_course_key;

  return jsonb_build_object(
    'key',             v_course.key,
    'title',           v_course.title,
    'subtitle',        v_course.subtitle,
    'description',     v_course.description,
    'icon',            v_course.icon,
    'total_days',      v_course.total_days,
    'pass_score',      v_course.pass_score,
    'exam_total',      jsonb_array_length(v_course.exam),
    'cards_total',     (select count(*) from public.course_cards cc where cc.course_key = v_course.key),
    'days_done',       coalesce(v_enr.days_done, 0),
    'started',         v_enr.tg_id is not null,
    'completed',       v_enr.completed_at is not null,
    'exam_attempts',   coalesce(v_enr.exam_attempts, 0),
    'available_today', v_enr.completed_at is null
                       and (v_enr.last_completed_on is null or v_enr.last_completed_on < current_date),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'day',      d.day,
               'title',    d.title,
               'subtitle', d.subtitle
             ) order by d.day), '[]'::jsonb)
        from public.course_days d
       where d.course_key = v_course.key
    ),
    'cards', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'key',     cc.card_key,
               'title',   cc.title,
               'icon',    cc.icon,
               'summary', cc.summary,
               'box',     p.box
             ) order by cc.ord), '[]'::jsonb)
        from public.course_card_progress p
        join public.course_cards cc on cc.course_key = p.course_key and cc.card_key = p.card_key
       where p.tg_id = p_tg_id and p.course_key = v_course.key
    ),
    'certificate', public.course_certificate_json(p_tg_id, v_course.key)
  );
end $$;

revoke all on function public.get_course(bigint, text) from public, anon, authenticated;
grant execute on function public.get_course(bigint, text) to service_role;

-- ------------------------------------------------------------
-- Старт текущего дня. Записывает на курс при первом заходе. Повторение
-- подбирается из карточек, чей due_day уже наступил (на последнем дне —
-- самые слабые независимо от due_day, перед тестом); упражнение для
-- карточки берётся по кругу из course_cards.review по числу повторений,
-- чтобы одна и та же карточка не показывала одно и то же дважды подряд.
-- ------------------------------------------------------------
create or replace function public.start_course_day(p_tg_id bigint, p_course_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course       public.courses;
  v_enr          public.course_enrollments;
  v_day          public.course_days;
  v_day_no       integer;
  v_is_last      boolean;
  v_review       jsonb;
  v_review_cards jsonb;
  v_new_cards    jsonb;
begin
  select * into v_course from public.courses where key = p_course_key and is_active;
  if not found then
    raise exception 'COURSE_NOT_FOUND';
  end if;

  insert into public.course_enrollments (tg_id, course_key)
  values (p_tg_id, p_course_key)
  on conflict (tg_id, course_key) do nothing;

  select * into v_enr from public.course_enrollments
   where tg_id = p_tg_id and course_key = p_course_key;

  if v_enr.completed_at is not null then
    raise exception 'COURSE_COMPLETED';
  end if;
  if v_enr.last_completed_on is not null and v_enr.last_completed_on >= current_date then
    raise exception 'COURSE_DAY_LOCKED';
  end if;

  v_day_no  := v_enr.days_done + 1;
  v_is_last := v_day_no >= v_course.total_days;

  select * into v_day from public.course_days
   where course_key = p_course_key and day = v_day_no;
  if not found then
    raise exception 'COURSE_DAY_NOT_FOUND';
  end if;

  with due as (
    select p.card_key, p.box, p.due_day, p.reviews, cc.review, cc.title, cc.icon, cc.ord
      from public.course_card_progress p
      join public.course_cards cc on cc.course_key = p.course_key and cc.card_key = p.card_key
     where p.tg_id = p_tg_id
       and p.course_key = p_course_key
       and (v_is_last or p.due_day <= v_day_no)
       and jsonb_array_length(cc.review) > 0
     order by p.box, p.due_day, cc.ord
     limit case when v_is_last then 6 else 3 end
  )
  select coalesce(jsonb_agg(
           (review -> (reviews % jsonb_array_length(review)))
             || jsonb_build_object('card', card_key, 'is_review', true)
           order by box, due_day, ord), '[]'::jsonb),
         coalesce(jsonb_agg(jsonb_build_object('key', card_key, 'title', title, 'icon', icon)
           order by box, due_day, ord), '[]'::jsonb)
    into v_review, v_review_cards
    from due;

  select coalesce(jsonb_agg(jsonb_build_object('key', card_key, 'title', title, 'icon', icon)
           order by ord), '[]'::jsonb)
    into v_new_cards
    from public.course_cards
   where course_key = p_course_key and card_key = any(v_day.cards);

  return jsonb_build_object(
    'course_key',    v_course.key,
    'course_title',  v_course.title,
    'day',           v_day_no,
    'total_days',    v_course.total_days,
    'title',         v_day.title,
    'subtitle',      v_day.subtitle,
    'is_last',       v_is_last,
    'theory',        v_day.theory,
    'practice',      v_day.practice,
    'review',        v_review,
    'new_cards',     v_new_cards,
    'review_cards',  v_review_cards,
    'exam',          case when v_is_last then v_course.exam else null end,
    'pass_score',    v_course.pass_score,
    'exam_attempts', v_enr.exam_attempts
  );
end $$;

revoke all on function public.start_course_day(bigint, text) from public, anon, authenticated;
grant execute on function public.start_course_day(bigint, text) to service_role;

-- ------------------------------------------------------------
-- Завершение дня. Обычный день: оценки карточек → Лейтнер, +5 монет.
-- Последний день: проверка теста; не сдал — попытка засчитана, день
-- остаётся открытым (можно пересдать сразу же); сдал — сертификат и
-- +30 монет. Награда — только при реальном переходе days_done вперёд
-- (под for update), повторный запрос получит COURSE_DAY_MISMATCH.
-- ------------------------------------------------------------
create or replace function public.complete_course_day(
  p_tg_id         bigint,
  p_course_key    text,
  p_day           integer,
  p_correct       integer,
  p_total         integer,
  p_ratings       jsonb,
  p_exam_answers  integer[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_reward  constant integer := 5;
  v_cert_reward constant integer := 30;
  v_course      public.courses;
  v_enr         public.course_enrollments;
  v_day         public.course_days;
  v_total       integer;
  v_correct     integer;
  v_score       integer;
  v_results     jsonb;
  v_balance     integer;
  v_card        text;
  v_rating      text;
  v_next_title  text;
begin
  select * into v_course from public.courses where key = p_course_key and is_active;
  if not found then
    raise exception 'COURSE_NOT_FOUND';
  end if;

  select * into v_enr from public.course_enrollments
   where tg_id = p_tg_id and course_key = p_course_key
   for update;
  if not found then
    raise exception 'COURSE_NOT_STARTED';
  end if;
  if v_enr.completed_at is not null then
    raise exception 'COURSE_COMPLETED';
  end if;
  if p_day is distinct from v_enr.days_done + 1 then
    raise exception 'COURSE_DAY_MISMATCH';
  end if;
  if v_enr.last_completed_on is not null and v_enr.last_completed_on >= current_date then
    raise exception 'COURSE_DAY_LOCKED';
  end if;

  select * into v_day from public.course_days where course_key = p_course_key and day = p_day;
  if not found then
    raise exception 'COURSE_DAY_NOT_FOUND';
  end if;

  -- ---- последний день: итоговый тест ----
  if p_day >= v_course.total_days then
    v_total := jsonb_array_length(v_course.exam_key);
    if p_exam_answers is null or coalesce(array_length(p_exam_answers, 1), 0) <> v_total then
      raise exception 'INVALID_EXAM_ANSWERS';
    end if;

    select count(*) filter (where p_exam_answers[i::int] = (k ->> 'answer')::int),
           jsonb_agg(jsonb_build_object(
             'answer',  (k ->> 'answer')::int,
             'chosen',  p_exam_answers[i::int],
             'correct', coalesce(p_exam_answers[i::int] = (k ->> 'answer')::int, false),
             'explain', k ->> 'explain'
           ) order by i)
      into v_score, v_results
      from jsonb_array_elements(v_course.exam_key) with ordinality as t(k, i);

    update public.course_enrollments
       set exam_attempts = exam_attempts + 1,
           exam_best     = greatest(coalesce(exam_best, 0), v_score)
     where tg_id = p_tg_id and course_key = p_course_key;

    if v_score < v_course.pass_score then
      return jsonb_build_object(
        'is_last',    true,
        'passed',     false,
        'score',      v_score,
        'exam_total', v_total,
        'pass_score', v_course.pass_score,
        'results',    v_results
      );
    end if;

    insert into public.course_day_completions (tg_id, course_key, day, correct, total)
    values (p_tg_id, p_course_key, p_day, v_score, v_total)
    on conflict do nothing;

    update public.course_enrollments
       set days_done         = p_day,
           last_completed_on = current_date,
           completed_at      = now(),
           certificate_no    = nextval('public.course_certificate_seq')
     where tg_id = p_tg_id and course_key = p_course_key;

    update public.users set coins = coins + v_cert_reward
     where tg_id = p_tg_id
    returning coins into v_balance;

    return jsonb_build_object(
      'is_last',       true,
      'passed',        true,
      'score',         v_score,
      'exam_total',    v_total,
      'pass_score',    v_course.pass_score,
      'results',       v_results,
      'coins_earned',  v_cert_reward,
      'coins_balance', v_balance,
      'certificate',   public.course_certificate_json(p_tg_id, p_course_key)
    );
  end if;

  -- ---- обычный день: Лейтнер по оценкам ----
  if p_ratings is not null and jsonb_typeof(p_ratings) = 'object' then
    for v_card, v_rating in select key, value from jsonb_each_text(p_ratings) loop
      continue when v_rating not in ('forgot', 'hard', 'easy');
      -- оценивать можно только то, что уже пройдено к этому дню
      continue when not exists (
        select 1 from public.course_cards
         where course_key = p_course_key and card_key = v_card and intro_day <= p_day
      );

      insert into public.course_card_progress (tg_id, course_key, card_key, box, due_day, last_rating)
      values (
        p_tg_id, p_course_key, v_card,
        case v_rating when 'forgot' then 1 when 'hard' then 2 else 3 end,
        p_day + case v_rating when 'forgot' then 1 when 'hard' then 2 else 4 end,
        v_rating
      )
      on conflict (tg_id, course_key, card_key) do update
        set box         = excluded.box,
            due_day     = excluded.due_day,
            reviews     = public.course_card_progress.reviews + 1,
            last_rating = excluded.last_rating,
            updated_at  = now();
    end loop;
  end if;

  -- Новые карточки дня, которые клиент почему-то не оценил, всё равно
  -- попадают в повторение («с трудом» по умолчанию) — иначе выпали бы
  -- из курса навсегда.
  insert into public.course_card_progress (tg_id, course_key, card_key, box, due_day, last_rating)
  select p_tg_id, p_course_key, c, 2, p_day + 2, 'hard'
    from unnest(v_day.cards) as c
  on conflict (tg_id, course_key, card_key) do nothing;

  v_total   := least(greatest(coalesce(p_total, 0), 0), 100);
  v_correct := least(greatest(coalesce(p_correct, 0), 0), v_total);

  insert into public.course_day_completions (tg_id, course_key, day, correct, total)
  values (p_tg_id, p_course_key, p_day, v_correct, v_total)
  on conflict do nothing;

  update public.course_enrollments
     set days_done = p_day, last_completed_on = current_date
   where tg_id = p_tg_id and course_key = p_course_key;

  update public.users set coins = coins + v_day_reward
   where tg_id = p_tg_id
  returning coins into v_balance;

  select title into v_next_title from public.course_days
   where course_key = p_course_key and day = p_day + 1;

  return jsonb_build_object(
    'is_last',        false,
    'day',            p_day,
    'total_days',     v_course.total_days,
    'correct',        v_correct,
    'total',          v_total,
    'coins_earned',   v_day_reward,
    'coins_balance',  v_balance,
    'next_day_title', v_next_title
  );
end $$;

revoke all on function public.complete_course_day(bigint, text, integer, integer, integer, jsonb, integer[]) from public, anon, authenticated;
grant execute on function public.complete_course_day(bigint, text, integer, integer, integer, jsonb, integer[]) to service_role;

-- ------------------------------------------------------------
-- Пуш «день курса ждёт» для tg-cron. Только тем, кто прошёл
-- предыдущий день ВЧЕРА (то есть реально идёт по курсу), ещё не прошёл
-- сегодняшний и не получал такой пуш сегодня. С 12:00 UTC (18:00
-- Бишкек): днём человек ещё может зайти сам, а день курса сменяется
-- в 00:00 UTC. Бросил курс на пару дней — пуши прекращаются, дальше
-- им занимается недельный инактивити-пуш (075_weekly_inactivity_nudge.sql).
-- ------------------------------------------------------------
create or replace function public.get_course_reminders(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if extract(hour from now() at time zone 'UTC') < 12 then
    return '[]'::jsonb;
  end if;

  with candidates as (
    select e.tg_id, e.course_key
      from public.course_enrollments e
      join public.users u on u.tg_id = e.tg_id
     where e.completed_at is null
       and e.days_done > 0
       and e.last_completed_on = current_date - 1
       and (e.nudged_on is null or e.nudged_on < current_date)
       and u.reminders_enabled
     order by e.tg_id
     limit p_limit
     for update of e skip locked
  ),
  marked as (
    update public.course_enrollments e
       set nudged_on = current_date
      from candidates c
     where e.tg_id = c.tg_id and e.course_key = c.course_key
    returning e.tg_id, e.course_key, e.days_done
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'tg_id',      m.tg_id,
           'first_name', u.first_name,
           'course_key', m.course_key,
           'day',        m.days_done + 1,
           'day_title',  d.title,
           'total_days', c.total_days
         )), '[]'::jsonb)
    into v_result
    from marked m
    join public.users u on u.tg_id = m.tg_id
    join public.courses c on c.key = m.course_key
    left join public.course_days d on d.course_key = m.course_key and d.day = m.days_done + 1;

  return v_result;
end $$;

revoke all on function public.get_course_reminders(integer) from public, anon, authenticated;
grant execute on function public.get_course_reminders(integer) to service_role;
