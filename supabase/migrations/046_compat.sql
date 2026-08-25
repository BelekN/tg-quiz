-- ============================================================
-- Тест на совместимость ("Для удовольствия" → 💞 Совместимость).
-- Механика — как у дуэли (host создаёт, делится ссылкой, guest
-- присоединяется, оба отвечают independently), но без времени и без
-- очков/монет: результат — % совпадения ответов, не победа/поражение.
--
-- Инвайт хост шлёт только ПОСЛЕ того, как сам ответил на все вопросы
-- (с экрана ожидания) — тот же порядок, что у дуэли (там тоже сначала
-- играешь сам, потом зовёшь с экрана результата).
-- ============================================================

create table if not exists public.compat_tests (
  key         text primary key,
  title       text not null,
  description text not null,
  icon        text not null,
  ord         integer not null default 0,
  is_active   boolean not null default true
);

create table if not exists public.compat_questions (
  id       uuid primary key default gen_random_uuid(),
  test_key text not null references public.compat_tests (key) on delete cascade,
  question text not null,
  ord      integer not null,
  unique (test_key, ord)
);

create table if not exists public.compat_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.compat_questions (id) on delete cascade,
  label       text not null,
  ord         integer not null,
  unique (question_id, ord)
);

do $$ begin
  create type public.compat_status as enum ('pending', 'completed');
exception when duplicate_object then null;
end $$;

create table if not exists public.compat_sessions (
  id            uuid primary key default gen_random_uuid(),
  test_key      text not null references public.compat_tests (key),
  host_tg_id    bigint  not null references public.users (tg_id) on delete cascade,
  guest_tg_id   bigint           references public.users (tg_id) on delete set null,
  -- фиксируем набор вопросов на сессию — на случай, если контент
  -- теста поменяют, пока сессия ещё не закрыта
  question_ids  uuid[]  not null,
  status        public.compat_status not null default 'pending',
  match_percent integer,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,

  constraint compat_guest_is_not_host check (guest_tg_id is null or guest_tg_id <> host_tg_id)
);

create table if not exists public.compat_answers (
  session_id   uuid   not null references public.compat_sessions (id) on delete cascade,
  tg_id        bigint not null references public.users (tg_id) on delete cascade,
  question_id  uuid   not null references public.compat_questions (id),
  option_index smallint not null,
  created_at   timestamptz not null default now(),
  primary key (session_id, tg_id, question_id)
);

alter table public.compat_tests     enable row level security;
alter table public.compat_questions enable row level security;
alter table public.compat_options   enable row level security;
alter table public.compat_sessions  enable row level security;
alter table public.compat_answers   enable row level security;
revoke all on table public.compat_tests     from public, anon, authenticated;
revoke all on table public.compat_questions from public, anon, authenticated;
revoke all on table public.compat_options   from public, anon, authenticated;
revoke all on table public.compat_sessions  from public, anon, authenticated;
revoke all on table public.compat_answers   from public, anon, authenticated;

-- ------------------------------------------------------------
-- Контент: 5 тестов × 8 вопросов × 4 варианта. delete+insert вопросов
-- (не on conflict) — тот же приём, что в personas.sql: можно
-- перезаливать повторно, options пересоздаются каскадом.
-- ------------------------------------------------------------
insert into public.compat_tests (key, title, description, icon, ord) values
  ('compat_general', 'Насколько вы совместимы?',   'Универсальный тест для друзей и пар — 8 вопросов о ценностях и привычках', '🤝', 1),
  ('compat_weekend', 'Как вы проведёте выходные?', 'Стиль отдыха: планы, компания, бюджет',                                    '🎉', 2),
  ('compat_love',    'Какие вы в паре?',            'Для тех, кто вместе — язык любви, ревность, конфликты',                    '💞', 3),
  ('compat_friends', 'Друзья или просто знакомые?', 'Шутливый тест на дружескую совместимость',                                 '🤪', 4),
  ('compat_travel',  'Путешествие мечты',           'Совпадает ли ваш стиль путешествий',                                       '✈️', 5)
on conflict (key) do update set
  title       = excluded.title,
  description = excluded.description,
  icon        = excluded.icon,
  ord         = excluded.ord;

delete from public.compat_questions
 where test_key in ('compat_general', 'compat_weekend', 'compat_love', 'compat_friends', 'compat_travel');

-- ---- compat_general ----
with q as (
  insert into public.compat_questions (test_key, question, ord) values
    ('compat_general', 'Как вы предпочитаете провести вечер?', 1),
    ('compat_general', 'Что вы делаете, если поссорились?', 2),
    ('compat_general', 'Идеальный отпуск — это…', 3),
    ('compat_general', 'Как вы принимаете решения?', 4),
    ('compat_general', 'Что для вас важнее в общении?', 5),
    ('compat_general', 'Утро или вечер?', 6),
    ('compat_general', 'Как относитесь к спонтанности?', 7),
    ('compat_general', 'Что вас злит больше всего?', 8)
  returning id, ord
)
insert into public.compat_options (question_id, label, ord)
select q.id, opt.label, opt.ord from q join (values
  (1,'Дома с фильмом',1),(1,'На шумной тусовке',2),(1,'Активный отдых на природе',3),(1,'Спокойная прогулка и разговор',4),
  (2,'Сразу обсуждаю и разбираюсь',1),(2,'Беру время подумать в одиночестве',2),(2,'Шучу, чтобы снять напряжение',3),(2,'Жду, чтобы всё само уладилось',4),
  (3,'Пляж и ничего не делать',1),(3,'Новый город и куча планов',2),(3,'Горы и активность',3),(3,'Тихое место без интернета',4),
  (4,'Слушаю интуицию',1),(4,'Составляю список плюсов и минусов',2),(4,'Спрашиваю совета у других',3),(4,'Решаю быстро и не оглядываюсь',4),
  (5,'Честность, даже если неприятно',1),(5,'Поддержка и мягкость',2),(5,'Юмор и лёгкость',3),(5,'Глубокие разговоры',4),
  (6,'Ранний подъём, бодрость с утра',1),(6,'Сова, лучшие мысли ночью',2),(6,'Плавно раскачиваюсь весь день',3),(6,'По настроению',4),
  (7,'Люблю неожиданные планы',1),(7,'Предпочитаю всё продумать заранее',2),(7,'Спонтанность ок, если не критично',3),(7,'Не люблю сюрпризы',4),
  (8,'Необязательность и опоздания',1),(8,'Ложь',2),(8,'Равнодушие',3),(8,'Излишний контроль',4)
) as opt(q_ord, label, ord) on opt.q_ord = q.ord;

-- ---- compat_weekend ----
with q as (
  insert into public.compat_questions (test_key, question, ord) values
    ('compat_weekend', 'Субботнее утро начинается с…', 1),
    ('compat_weekend', 'Куда идём в свободный день?', 2),
    ('compat_weekend', 'Компания на вечер…', 3),
    ('compat_weekend', 'Развлечение по вкусу…', 4),
    ('compat_weekend', 'Бюджет на выходные…', 5),
    ('compat_weekend', 'Что делаем в дождь?', 6),
    ('compat_weekend', 'Еда на выходных…', 7),
    ('compat_weekend', 'Идеальное завершение выходных…', 8)
  returning id, ord
)
insert into public.compat_options (question_id, label, ord)
select q.id, opt.label, opt.ord from q join (values
  (1,'Спортзала или пробежки',1),(1,'Долгого завтрака в кафе',2),(1,'Валяния в кровати подольше',3),(1,'Списка дел по дому',4),
  (2,'В новый ресторан',1),(2,'На природу, подальше от города',2),(2,'По магазинам',3),(2,'Никуда, идеальный план — не выходить',4),
  (3,'Большая шумная компания',1),(3,'Один близкий человек',2),(3,'Сам(а) с собой',3),(3,'Незнакомые новые люди',4),
  (4,'Кино/сериал',1),(4,'Настольная игра',2),(4,'Концерт или вечеринка',3),(4,'Книга',4),
  (5,'Трачу не считая',1),(5,'Строго по плану',2),(5,'Ищу бесплатные варианты',3),(5,'Как получится',4),
  (6,'Всё равно идём гулять',1),(6,'Сидим дома с чаем',2),(6,'Едем в кино/музей',3),(6,'Спим подольше',4),
  (7,'Готовим вместе что-то новое',1),(7,'Заказываем доставку',2),(7,'Идём в любимое место',3),(7,'Перехватываем на бегу',4),
  (8,'Рано лечь спать, готовясь к неделе',1),(8,'Засидеться допоздна',2),(8,'Подвести итоги дня с кем-то',3),(8,'Ничего не планировать, как пойдёт',4)
) as opt(q_ord, label, ord) on opt.q_ord = q.ord;

-- ---- compat_love ----
with q as (
  insert into public.compat_questions (test_key, question, ord) values
    ('compat_love', 'Язык любви для вас — это…', 1),
    ('compat_love', 'Как вы показываете, что скучаете?', 2),
    ('compat_love', 'Ревность — это…', 3),
    ('compat_love', 'Личное пространство в отношениях…', 4),
    ('compat_love', 'Как решаете, что смотреть/делать вместе?', 5),
    ('compat_love', 'Планы на будущее обсуждаете…', 6),
    ('compat_love', 'Комплименты вам приятнее…', 7),
    ('compat_love', 'В конфликте важнее…', 8)
  returning id, ord
)
insert into public.compat_options (question_id, label, ord)
select q.id, opt.label, opt.ord from q join (values
  (1,'Слова и комплименты',1),(1,'Подарки и знаки внимания',2),(1,'Совместное время',3),(1,'Забота о быте',4),
  (2,'Пишу сразу',1),(2,'Жду, кто первый напишет',2),(2,'Готовлю сюрприз к встрече',3),(2,'Просто говорю прямо при встрече',4),
  (3,'Немного льстит',1),(3,'Раздражает',2),(3,'Признак неуверенности партнёра',3),(3,'Не испытываю вообще',4),
  (4,'Очень важно, нужно много «себя»',1),(4,'Люблю быть рядом почти всегда',2),(4,'Зависит от настроения',3),(4,'Важно, но не критично',4),
  (5,'По очереди выбираем',1),(5,'Кто сильнее хочет — тот выбирает',2),(5,'Ищем компромисс',3),(5,'Мне всё равно, выбирай ты',4),
  (6,'Часто и подробно',1),(6,'Иногда, без давления',2),(6,'Редко, живём моментом',3),(6,'Только по важным поводам',4),
  (7,'О внешности',1),(7,'Об уме и характере',2),(7,'О поступках',3),(7,'Не люблю комплименты, лучше дела',4),
  (8,'Быть услышанным',1),(8,'Быстро помириться',2),(8,'Найти, кто прав',3),(8,'Дать друг другу время',4)
) as opt(q_ord, label, ord) on opt.q_ord = q.ord;

-- ---- compat_friends ----
with q as (
  insert into public.compat_questions (test_key, question, ord) values
    ('compat_friends', 'Если я опаздываю на встречу…', 1),
    ('compat_friends', 'Мой худший каприз — это…', 2),
    ('compat_friends', 'Лучший способ меня развеселить…', 3),
    ('compat_friends', 'Если бы мы попали на необитаемый остров…', 4),
    ('compat_friends', 'Секреты друг другу рассказываем…', 5),
    ('compat_friends', 'Общие траты (кино, кафе)…', 6),
    ('compat_friends', 'Если у меня плохой день…', 7),
    ('compat_friends', 'Наша дружба — это…', 8)
  returning id, ord
)
insert into public.compat_options (question_id, label, ord)
select q.id, opt.label, opt.ord from q join (values
  (1,'Ты уже привык(ла), не проблема',1),(1,'Немного раздражаешься',2),(1,'Пишешь язвительное сообщение',3),(1,'Уходишь без меня',4),
  (2,'Долго выбирать, что поесть',1),(2,'Постоянно менять планы',2),(2,'Пропадать без вести',3),(2,'Спорить по мелочам',4),
  (3,'Мемы в чат',1),(3,'Позвать погулять',2),(3,'Просто послушать',3),(3,'Устроить авантюру',4),
  (4,'Ты бы организовал(а) выживание',1),(4,'Я бы придумывал шутки, ты бы спасал(а) нас',2),(4,'Мы бы поссорились в первый день',3),(4,'Идеальная команда без слов',4),
  (5,'Всё без исключений',1),(5,'Только важное',2),(5,'Иногда что-то по мелочи',3),(5,'Стараюсь не грузить',4),
  (6,'Всегда 50/50',1),(6,'Кто богаче в моменте',2),(6,'По очереди платим',3),(6,'Считаем до копейки, шутка (или не шутка)',4),
  (7,'Ты сразу спросишь, что случилось',1),(7,'Дашь побыть одному(ой)',2),(7,'Позовёшь развеяться',3),(7,'Не заметишь, если не скажу',4),
  (8,'На всю жизнь',1),(8,'До следующего переезда',2),(8,'Пока комфортно обоим',3),(8,'Уже пережила многое',4)
) as opt(q_ord, label, ord) on opt.q_ord = q.ord;

-- ---- compat_travel ----
with q as (
  insert into public.compat_questions (test_key, question, ord) values
    ('compat_travel', 'Планирование поездки…', 1),
    ('compat_travel', 'Бюджет в путешествии…', 2),
    ('compat_travel', 'Идеальное жильё…', 3),
    ('compat_travel', 'Транспорт в путешествии…', 4),
    ('compat_travel', 'Еда в поездке…', 5),
    ('compat_travel', 'Если рейс задержали на 6 часов…', 6),
    ('compat_travel', 'Фотографии в путешествии…', 7),
    ('compat_travel', 'После поездки хочется…', 8)
  returning id, ord
)
insert into public.compat_options (question_id, label, ord)
select q.id, opt.label, opt.ord from q join (values
  (1,'Расписано по часам',1),(1,'Только билеты и жильё, остальное на месте',2),(1,'Ноль планов, куда глаза глядят',3),(1,'Список «что обязательно увидеть»',4),
  (2,'Экономим на всём',1),(2,'Тратим на впечатления, экономим на быте',2),(2,'Комфорт важнее экономии',3),(2,'Не считаем, разберёмся',4),
  (3,'Отель со всеми удобствами',1),(3,'Хостел, чтобы знакомиться с людьми',2),(3,'Квартира как местный',3),(3,'Палатка/кемпинг',4),
  (4,'Арендуем машину',1),(4,'Общественный транспорт',2),(4,'Пешком, чтобы всё увидеть',3),(4,'Такси/каршеринг без раздумий',4),
  (5,'Ищем локальные места без туристов',1),(5,'Проверенные варианты, без риска',2),(5,'Пробуем всё подряд',3),(5,'Фастфуд, если голодно — и норм',4),
  (6,'Исследуем аэропорт/город рядом',1),(6,'Раздражаюсь, но терплю',2),(6,'Работаю/читаю, не парюсь',3),(6,'Ищу, с кем поговорить от скуки',4),
  (7,'Снимаю всё и всех',1),(7,'Пара кадров на память',2),(7,'Живу моментом, камеру не достаю',3),(7,'Профессионально, ищу лучший кадр',4),
  (8,'Сразу планировать следующую',1),(8,'Отдохнуть от отдыха',2),(8,'Поделиться впечатлениями со всеми',3),(8,'Пересмотреть фото и оставить в памяти',4)
) as opt(q_ord, label, ord) on opt.q_ord = q.ord;

-- ------------------------------------------------------------
-- get_compat_tests — каталог
-- ------------------------------------------------------------
create or replace function public.get_compat_tests()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'key', key, 'title', title, 'description', description, 'icon', icon
         ) order by ord), '[]'::jsonb)
    from public.compat_tests
   where is_active;
$$;

revoke all on function public.get_compat_tests() from public, anon, authenticated;
grant execute on function public.get_compat_tests() to service_role;

-- ------------------------------------------------------------
-- start_compat — p_test_key задан -> хост создаёт сессию;
-- p_session_id задан -> присоединение гостя (или резюме хоста).
-- Варианты ответа перемешаны по сиду "<session_id>:<question_id>" —
-- одинаково для хоста и гостя (иначе сравнение по индексу сломается).
-- ------------------------------------------------------------
create or replace function public.start_compat(
  p_tg_id      bigint,
  p_test_key   text default null,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.compat_sessions;
  v_test    public.compat_tests;
  v_role    text;
  v_ids     uuid[];
  v_questions jsonb;
begin
  if p_session_id is null then
    if p_test_key is null then
      raise exception 'TEST_KEY_REQUIRED';
    end if;

    select * into v_test from public.compat_tests where key = p_test_key and is_active;
    if not found then
      raise exception 'TEST_NOT_FOUND';
    end if;

    select array_agg(id order by ord) into v_ids
      from public.compat_questions where test_key = p_test_key;

    insert into public.compat_sessions (test_key, host_tg_id, question_ids)
    values (p_test_key, p_tg_id, v_ids)
    returning * into v_session;

    v_role := 'host';
  else
    select * into v_session from public.compat_sessions where id = p_session_id for update;
    if not found then
      raise exception 'SESSION_NOT_FOUND';
    end if;

    if v_session.host_tg_id = p_tg_id then
      v_role := 'host';
    else
      if v_session.guest_tg_id is not null and v_session.guest_tg_id <> p_tg_id then
        raise exception 'SESSION_ALREADY_TAKEN';
      end if;
      if v_session.guest_tg_id is null then
        update public.compat_sessions set guest_tg_id = p_tg_id
         where id = v_session.id
        returning * into v_session;
      end if;
      v_role := 'guest';
    end if;

    select * into v_test from public.compat_tests where key = v_session.test_key;
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'id',       cq.id,
             'question', cq.question,
             'options',  (
               select jsonb_agg(o.label order by random_ord)
                 from (
                   select label, md5(v_session.id::text || ':' || cq.id::text || ':' || ord) as random_ord
                     from public.compat_options where question_id = cq.id
                 ) o
             )
           ) order by cq.ord
         )
    into v_questions
    from public.compat_questions cq
   where cq.id = any(v_session.question_ids);

  return jsonb_build_object(
    'session_id', v_session.id,
    'role',       v_role,
    'test_key',   v_test.key,
    'title',      v_test.title,
    'description', v_test.description,
    'icon',       v_test.icon,
    'questions',  v_questions
  );
end $$;

revoke all on function public.start_compat(bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.start_compat(bigint, text, uuid) to service_role;

-- ------------------------------------------------------------
-- answer_compat — идемпотентно (on conflict do update: последний
-- ответ побеждает, повторный заход с начала просто перезапишет).
-- Если после этого ответа обе стороны ответили на все вопросы —
-- сразу считаем % совпадения и закрываем сессию.
-- ------------------------------------------------------------
create or replace function public.answer_compat(
  p_tg_id        bigint,
  p_session_id   uuid,
  p_question_id  uuid,
  p_option_index smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session      public.compat_sessions;
  v_total        integer;
  v_my_answered  integer;
  v_other_id     bigint;
  v_other_answered integer;
  v_match        integer;
begin
  select * into v_session from public.compat_sessions where id = p_session_id for update;
  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if p_tg_id <> v_session.host_tg_id and p_tg_id <> coalesce(v_session.guest_tg_id, -1) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  if not (p_question_id = any(v_session.question_ids)) then
    raise exception 'QUESTION_NOT_IN_SESSION';
  end if;

  insert into public.compat_answers (session_id, tg_id, question_id, option_index)
  values (p_session_id, p_tg_id, p_question_id, p_option_index)
  on conflict (session_id, tg_id, question_id) do update
    set option_index = excluded.option_index, created_at = now();

  v_total := array_length(v_session.question_ids, 1);

  select count(*) into v_my_answered
    from public.compat_answers where session_id = p_session_id and tg_id = p_tg_id;

  v_other_id := case when p_tg_id = v_session.host_tg_id then v_session.guest_tg_id else v_session.host_tg_id end;

  if v_other_id is not null and v_my_answered = v_total then
    select count(*) into v_other_answered
      from public.compat_answers where session_id = p_session_id and tg_id = v_other_id;

    if v_other_answered = v_total then
      select round(100.0 * count(*) filter (where a.option_index = b.option_index) / v_total)
        into v_match
        from public.compat_answers a
        join public.compat_answers b
          on a.question_id = b.question_id and a.session_id = b.session_id
       where a.session_id = p_session_id and a.tg_id = v_session.host_tg_id
         and b.tg_id = v_session.guest_tg_id;

      update public.compat_sessions
         set status = 'completed', match_percent = v_match, completed_at = now()
       where id = p_session_id
      returning * into v_session;
    end if;
  end if;

  return jsonb_build_object(
    'my_answered',       v_my_answered,
    'total',              v_total,
    'session_completed',  v_session.status = 'completed',
    'match_percent',      v_session.match_percent
  );
end $$;

revoke all on function public.answer_compat(bigint, uuid, uuid, smallint) from public, anon, authenticated;
grant execute on function public.answer_compat(bigint, uuid, uuid, smallint) to service_role;

-- ------------------------------------------------------------
-- get_compat_progress — поллинг для хоста, ждущего гостя
-- ------------------------------------------------------------
create or replace function public.get_compat_progress(
  p_tg_id      bigint,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_session public.compat_sessions;
  v_total   integer;
  v_guest_answered integer;
begin
  select * into v_session from public.compat_sessions where id = p_session_id;
  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if p_tg_id <> v_session.host_tg_id and p_tg_id <> coalesce(v_session.guest_tg_id, -1) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  v_total := array_length(v_session.question_ids, 1);

  if v_session.guest_tg_id is null then
    return jsonb_build_object(
      'guest_joined', false, 'guest_answered', 0, 'total', v_total,
      'completed', false, 'match_percent', null
    );
  end if;

  select count(*) into v_guest_answered
    from public.compat_answers where session_id = p_session_id and tg_id = v_session.guest_tg_id;

  return jsonb_build_object(
    'guest_joined',   true,
    'guest_answered', v_guest_answered,
    'total',          v_total,
    'completed',      v_session.status = 'completed',
    'match_percent',  v_session.match_percent
  );
end $$;

revoke all on function public.get_compat_progress(bigint, uuid) from public, anon, authenticated;
grant execute on function public.get_compat_progress(bigint, uuid) to service_role;

-- ------------------------------------------------------------
-- get_compat_session_test — для карточки инлайн-инвайта в tg-webhook
-- (не привязано к конкретному пользователю — просто метаданные теста
-- по сессии, для текста приглашения).
-- ------------------------------------------------------------
create or replace function public.get_compat_session_test(p_session_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object('title', t.title, 'icon', t.icon)
    from public.compat_sessions s
    join public.compat_tests t on t.key = s.test_key
   where s.id = p_session_id;
$$;

revoke all on function public.get_compat_session_test(uuid) from public, anon, authenticated;
grant execute on function public.get_compat_session_test(uuid) to service_role;
