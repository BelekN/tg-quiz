-- ============================================================
-- Нумерология — 5 тестов по дате рождения (без имени: кириллица не
-- имеет единого стандарта перевода букв в числа, решили не гадать).
-- В отличие от "Узнай себя"/"Совместимость" здесь нет ни вопросов,
-- ни сессий — чистый калькулятор: ввёл дату, сразу получил число и
-- расшифровку. Поэтому и схема сильно проще — каталог + банк
-- расшифровок по числу, без sessions/answers.
--
-- 1 бесплатный (Число жизненного пути — самый известный концепт,
-- крючок), 4 платных (по 500 монет каждый, разблокируются по
-- отдельности, не пакетом).
-- ============================================================

create table if not exists public.numerology_tests (
  key         text primary key,
  title       text not null,
  description text not null,
  icon        text not null,
  price_coins integer not null default 0 check (price_coins >= 0),
  ord         integer not null default 0,
  is_active   boolean not null default true
);

-- slot различает несколько чисел внутри одного теста ("Циклы жизни"
-- отдаёт 3 числа разом — formative/productive/harvest), у остальных
-- тестов один слот 'main'.
create table if not exists public.numerology_results (
  id          uuid primary key default gen_random_uuid(),
  test_key    text not null references public.numerology_tests (key) on delete cascade,
  slot        text not null default 'main',
  number      integer not null,
  title       text not null,
  description text not null,
  unique (test_key, slot, number)
);

alter table public.users add column if not exists unlocked_numerology_tests text[]
  not null default '{}';

alter table public.numerology_tests   enable row level security;
alter table public.numerology_results enable row level security;
revoke all on table public.numerology_tests   from public, anon, authenticated;
revoke all on table public.numerology_results from public, anon, authenticated;

-- ------------------------------------------------------------
-- Вспомогательные функции: сумма цифр числа и свёртка в одну цифру
-- (с опциональным сохранением мастер-чисел 11/22/33 — стандартная
-- нумерологическая практика: они не сворачиваются дальше).
-- ------------------------------------------------------------
create or replace function public.numerology_digit_sum(p_n integer)
returns integer
language sql
immutable
as $$
  select sum(digit::integer)
    from unnest(string_to_array(abs(p_n)::text, null)) as digit;
$$;

create or replace function public.numerology_reduce(p_n integer, p_keep_master boolean default true)
returns integer
language plpgsql
immutable
as $$
declare
  v integer := abs(p_n);
begin
  while v > 9 loop
    if p_keep_master and v in (11, 22, 33) then
      return v;
    end if;
    v := public.numerology_digit_sum(v);
  end loop;
  return v;
end $$;

revoke all on function public.numerology_digit_sum(integer) from public, anon, authenticated;
revoke all on function public.numerology_reduce(integer, boolean) from public, anon, authenticated;
grant execute on function public.numerology_digit_sum(integer) to service_role;
grant execute on function public.numerology_reduce(integer, boolean) to service_role;

-- ------------------------------------------------------------
-- Каталог
-- ------------------------------------------------------------
insert into public.numerology_tests (key, title, description, icon, price_coins, ord) values
  ('numerology_life_path',  'Число жизненного пути', 'Главное число нумерологии — твоя основная жизненная задача', '🌟', 0,   1),
  ('numerology_birthday',   'Число дня рождения',     'Талант, заложенный именно днём, в который ты родился',        '🎂', 500, 2),
  ('numerology_year',       'Число текущего года',    'Что этот год готовит именно тебе — обновляется каждый год',   '📅', 500, 3),
  ('numerology_challenge',  'Число испытания',        'Урок, который тебе предстоит освоить в этой жизни',           '⚔️', 500, 4),
  ('numerology_cycles',     'Циклы твоей жизни',      'Три числа: юность, зрелость и мудрость — что определяет каждую', '🌗', 500, 5)
on conflict (key) do update set
  title       = excluded.title,
  description = excluded.description,
  icon        = excluded.icon,
  price_coins = excluded.price_coins,
  ord         = excluded.ord;

delete from public.numerology_results
 where test_key in (
   'numerology_life_path', 'numerology_birthday', 'numerology_year',
   'numerology_challenge', 'numerology_cycles'
 );

-- ---- numerology_life_path: 1-9, 11, 22, 33 ----
insert into public.numerology_results (test_key, number, title, description) values
  ('numerology_life_path', 1,  'Лидер',      'Врождённый инициатор и первопроходец. Тебе некомфортно в чужой тени — ты создаёшь свой путь и ведёшь других за собой.'),
  ('numerology_life_path', 2,  'Миротворец', 'Дипломат по натуре, чувствуешь настроение других лучше, чем свои собственные. Твоя сила — в сотрудничестве, а не в соперничестве.'),
  ('numerology_life_path', 3,  'Творец',     'Яркость и самовыражение — твоя стихия. Слова, образы, идеи рождаются легко, но так же легко теряется фокус.'),
  ('numerology_life_path', 4,  'Строитель',  'Надёжность и порядок для тебя не ограничение, а фундамент. Ты создаёшь то, что стоит десятилетиями.'),
  ('numerology_life_path', 5,  'Искатель',   'Свобода и перемены — твой воздух. Рутина душит, а новый опыт заряжает энергией на месяцы вперёд.'),
  ('numerology_life_path', 6,  'Хранитель',  'Забота о близких у тебя в крови. Дом, семья, гармония — там, где ты чувствуешь себя настоящим собой.'),
  ('numerology_life_path', 7,  'Мыслитель',  'Тебя тянет к глубине, а не к поверхности. Одиночество не пугает — там ты находишь ответы, которые не даёт суета.'),
  ('numerology_life_path', 8,  'Стратег',    'Амбиции и практичность идут рука об руку. Деньги и статус для тебя не цель, а инструмент влияния.'),
  ('numerology_life_path', 9,  'Гуманист',   'Ты чувствуешь мир шире, чем большинство. Твоя энергия — отдавать, вдохновлять, менять что-то большее, чем ты сам.'),
  ('numerology_life_path', 11, 'Провидец (мастер-число)',   'Интуиция на пределе обычного восприятия. Ты видишь то, что другие замечают позже — если научишься доверять себе.'),
  ('numerology_life_path', 22, 'Архитектор (мастер-число)', 'Редкое сочетание масштабного видения и практической силы воплотить его в реальность.'),
  ('numerology_life_path', 33, 'Наставник (мастер-число)',  'Самое редкое число — сочетание заботы и мудрости, которое меняет тех, кто рядом.');

-- ---- numerology_birthday: 1-9, 11, 22 ----
insert into public.numerology_results (test_key, number, title, description) values
  ('numerology_birthday', 1,  'Первый', 'Независимость у тебя в характере с детства. Тебе важно делать всё по-своему.'),
  ('numerology_birthday', 2,  'Чуткий', 'Ты внимателен к деталям в отношениях — люди тянутся к твоему спокойствию.'),
  ('numerology_birthday', 3,  'Искренний', 'Общительность и лёгкость — твои сильные стороны. Скучно рядом с тобой не бывает.'),
  ('numerology_birthday', 4,  'Основательный', 'Дисциплина и практичность — твои опоры. Ты редко бросаешь начатое на полпути.'),
  ('numerology_birthday', 5,  'Подвижный', 'Любопытство и жажда движения — твой мотор. Стабильность быстро превращается в скуку.'),
  ('numerology_birthday', 6,  'Заботливый', 'Ответственность за других — твоя естественная роль, даже когда никто не просит.'),
  ('numerology_birthday', 7,  'Пытливый', 'Аналитический ум и тяга к загадкам. Тебе важно разобраться «почему», а не просто принять «как есть».'),
  ('numerology_birthday', 8,  'Целеустремлённый', 'Деловая хватка проявилась рано. Ты умеешь доводить дело до результата.'),
  ('numerology_birthday', 9,  'Щедрый', 'Широкий взгляд на мир. Мелочи тебя редко трогают — ты видишь картину целиком.'),
  ('numerology_birthday', 11, 'Чувствующий (мастер-число)', 'Особая чувствительность и обострённая интуиция — ты часто «знаешь» раньше, чем понимаешь, откуда.'),
  ('numerology_birthday', 22, 'Созидающий (мастер-число)', 'Редкое сочетание мечтательности и практической силы — ты умеешь превращать идеи в результат.');

-- ---- numerology_year: 1-9 (личный год, без мастер-чисел) ----
insert into public.numerology_results (test_key, number, title, description) values
  ('numerology_year', 1, 'Год начал',       'Время для новых стартов, смелых решений и первых шагов в непривычную сторону.'),
  ('numerology_year', 2, 'Год терпения',    'Партнёрства, сотрудничество и умение слушать важнее рывков и спешки.'),
  ('numerology_year', 3, 'Год самовыражения', 'Удачное время для творчества, общения и всего, что требует лёгкости.'),
  ('numerology_year', 4, 'Год фундамента',  'Работа, порядок и дисциплина принесут больше, чем поиск коротких путей.'),
  ('numerology_year', 5, 'Год перемен',     'Неожиданные повороты, новые люди и обстоятельства — держись за гибкость, а не за план.'),
  ('numerology_year', 6, 'Год близких',     'Семья, дом и отношения выходят на первый план — вложения туда окупятся сторицей.'),
  ('numerology_year', 7, 'Год паузы',       'Время заглянуть внутрь, а не наружу — ответы придут через размышление, не через суету.'),
  ('numerology_year', 8, 'Год результата',  'Усилия прошлых лет начинают окупаться — амбиции сейчас оправданы.'),
  ('numerology_year', 9, 'Год завершений',  'Время отпускать то, что отжило, чтобы освободить место для нового цикла.');

-- ---- numerology_challenge: 0-8 (|reduce(month)-reduce(day)|, без мастер-чисел) ----
insert into public.numerology_results (test_key, number, title, description) values
  ('numerology_challenge', 0, 'Вызов гибкости',       'Научиться не держаться жёстко ни одного варианта и видеть все пути сразу.'),
  ('numerology_challenge', 1, 'Вызов независимости',  'Научиться доверять себе и не ждать одобрения, чтобы начать действовать.'),
  ('numerology_challenge', 2, 'Вызов чувствительности', 'Научиться не растворяться в чужих ожиданиях, сохраняя себя.'),
  ('numerology_challenge', 3, 'Вызов самовыражения',  'Научиться говорить и показывать то, что чувствуешь, не боясь оценки.'),
  ('numerology_challenge', 4, 'Вызов дисциплины',     'Научиться держать порядок и доводить дело до конца без внешнего давления.'),
  ('numerology_challenge', 5, 'Вызов свободы',        'Научиться менять обстоятельства без страха потерять стабильность.'),
  ('numerology_challenge', 6, 'Вызов баланса заботы', 'Научиться помогать другим, не забывая о собственных границах.'),
  ('numerology_challenge', 7, 'Вызов доверия',        'Научиться опираться не только на логику, но и на внутреннее чутьё.'),
  ('numerology_challenge', 8, 'Вызов власти денег',   'Научиться использовать амбиции и ресурсы без потери себя.');

-- ---- numerology_cycles: 3 слота (formative/productive/harvest) × 1-9 ----
insert into public.numerology_results (test_key, slot, number, title, description) values
  ('numerology_cycles', 'formative', 1, 'Число 1', 'В юности ты рано учишься быть первым и не бояться начинать сам.'),
  ('numerology_cycles', 'formative', 2, 'Число 2', 'В юности ты учишься чуткости — понимать других раньше, чем себя.'),
  ('numerology_cycles', 'formative', 3, 'Число 3', 'В юности яркость и общительность формируют твой характер быстрее, чем у сверстников.'),
  ('numerology_cycles', 'formative', 4, 'Число 4', 'В юности дисциплина и труд закладывают фундамент на всю оставшуюся жизнь.'),
  ('numerology_cycles', 'formative', 5, 'Число 5', 'В юности перемены и поиск себя — не хаос, а естественный этап становления.'),
  ('numerology_cycles', 'formative', 6, 'Число 6', 'В юности забота о близких формирует в тебе раннюю ответственность.'),
  ('numerology_cycles', 'formative', 7, 'Число 7', 'В юности склонность к размышлениям и одиночеству — способ узнать себя глубже.'),
  ('numerology_cycles', 'formative', 8, 'Число 8', 'В юности амбиции и целеустремлённость проявляются раньше, чем у большинства.'),
  ('numerology_cycles', 'formative', 9, 'Число 9', 'В юности широта взглядов и щедрость формируются через опыт, который старше твоих лет.'),

  ('numerology_cycles', 'productive', 1, 'Число 1', 'В зрелости лидерство и инициатива приносят главные результаты этого периода.'),
  ('numerology_cycles', 'productive', 2, 'Число 2', 'В зрелости партнёрства и умение договариваться становятся твоей главной силой.'),
  ('numerology_cycles', 'productive', 3, 'Число 3', 'В зрелости творчество и самовыражение находят наиболее зрелую, уверенную форму.'),
  ('numerology_cycles', 'productive', 4, 'Число 4', 'В зрелости построенное трудом и порядком становится прочной опорой на годы.'),
  ('numerology_cycles', 'productive', 5, 'Число 5', 'В зрелости смелость к переменам открывает возможности, недоступные в юности.'),
  ('numerology_cycles', 'productive', 6, 'Число 6', 'В зрелости семья и забота о близких занимают центральное место этого периода.'),
  ('numerology_cycles', 'productive', 7, 'Число 7', 'В зрелости глубина и мудрость становятся заметнее для окружающих, чем раньше.'),
  ('numerology_cycles', 'productive', 8, 'Число 8', 'В зрелости амбиции и практичность приносят результат, накопленный годами.'),
  ('numerology_cycles', 'productive', 9, 'Число 9', 'В зрелости способность отдавать и вести за собой раскрывается в полную силу.'),

  ('numerology_cycles', 'harvest', 1, 'Число 1', 'В зрелые годы независимость и ясность взгляда становятся твоей визитной карточкой.'),
  ('numerology_cycles', 'harvest', 2, 'Число 2', 'В зрелые годы мягкость и умение слушать делают тебя опорой для близких.'),
  ('numerology_cycles', 'harvest', 3, 'Число 3', 'В зрелые годы лёгкость и радость от простых вещей — твой главный дар себе.'),
  ('numerology_cycles', 'harvest', 4, 'Число 4', 'В зрелые годы то, что выстроено за жизнь, становится наследием для других.'),
  ('numerology_cycles', 'harvest', 5, 'Число 5', 'В зрелые годы свобода и лёгкость на подъём остаются с тобой, несмотря на возраст.'),
  ('numerology_cycles', 'harvest', 6, 'Число 6', 'В зрелые годы забота и мудрость делают тебя настоящей опорой для семьи.'),
  ('numerology_cycles', 'harvest', 7, 'Число 7', 'В зрелые годы понимание и внутренний покой становятся естественным состоянием.'),
  ('numerology_cycles', 'harvest', 8, 'Число 8', 'В зрелые годы результаты труда всей жизни раскрываются в полной мере.'),
  ('numerology_cycles', 'harvest', 9, 'Число 9', 'В зрелые годы щедрость и умение делиться опытом становятся твоим главным вкладом.');

-- ------------------------------------------------------------
-- get_numerology_tests — каталог с ценой/разблокировкой
-- ------------------------------------------------------------
create or replace function public.get_numerology_tests(p_tg_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_unlocked text[];
  v_result   jsonb;
begin
  select coalesce(unlocked_numerology_tests, '{}') into v_unlocked
    from public.users where tg_id = p_tg_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'key',         key,
           'title',       title,
           'description', description,
           'icon',        icon,
           'price_coins', price_coins,
           'unlocked',    price_coins = 0 or key = any(coalesce(v_unlocked, '{}'))
         ) order by ord), '[]'::jsonb)
    into v_result
    from public.numerology_tests
   where is_active;

  return v_result;
end $$;

revoke all on function public.get_numerology_tests(bigint) from public, anon, authenticated;
grant execute on function public.get_numerology_tests(bigint) to service_role;

-- ------------------------------------------------------------
-- buy_numerology_test — разблокировка одного теста (не пакетом)
-- ------------------------------------------------------------
create or replace function public.buy_numerology_test(
  p_tg_id    bigint,
  p_test_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price integer;
  v_user  public.users;
begin
  select price_coins into v_price
    from public.numerology_tests
   where key = p_test_key and is_active;

  if v_price is null then
    raise exception 'TEST_NOT_FOUND';
  end if;
  if v_price = 0 then
    raise exception 'NOT_PAID_TEST';
  end if;

  if exists (
    select 1 from public.users
     where tg_id = p_tg_id and p_test_key = any(coalesce(unlocked_numerology_tests, '{}'))
  ) then
    raise exception 'ALREADY_UNLOCKED';
  end if;

  update public.users
     set coins = coins - v_price,
         unlocked_numerology_tests = array_append(coalesce(unlocked_numerology_tests, '{}'), p_test_key),
         updated_at = now()
   where tg_id = p_tg_id and coins >= v_price
  returning * into v_user;

  if not found then
    raise exception 'NOT_ENOUGH_COINS';
  end if;

  return jsonb_build_object('user', to_jsonb(v_user), 'test_key', p_test_key);
end $$;

revoke all on function public.buy_numerology_test(bigint, text) from public, anon, authenticated;
grant execute on function public.buy_numerology_test(bigint, text) to service_role;

-- ------------------------------------------------------------
-- compute_numerology — чистый калькулятор: дата не сохраняется,
-- результат считается на лету и сразу возвращается.
-- ------------------------------------------------------------
create or replace function public.compute_numerology(
  p_tg_id    bigint,
  p_test_key text,
  p_day      integer,
  p_month    integer,
  p_year     integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_test     public.numerology_tests;
  v_unlocked text[];
  v_numbers  jsonb := '[]'::jsonb;
  v_row      record;
begin
  if p_day is null or p_month is null or p_year is null
     or p_day < 1 or p_day > 31 or p_month < 1 or p_month > 12
     or p_year < 1900 or p_year > extract(year from current_date)::integer then
    raise exception 'INVALID_DATE';
  end if;

  select * into v_test from public.numerology_tests where key = p_test_key and is_active;
  if not found then
    raise exception 'TEST_NOT_FOUND';
  end if;

  if v_test.price_coins > 0 then
    select coalesce(unlocked_numerology_tests, '{}') into v_unlocked
      from public.users where tg_id = p_tg_id;
    if not (p_test_key = any(v_unlocked)) then
      raise exception 'NOT_UNLOCKED';
    end if;
  end if;

  if p_test_key = 'numerology_life_path' then
    select number, title, description into v_row from public.numerology_results
     where test_key = p_test_key and slot = 'main'
       and number = public.numerology_reduce(
             public.numerology_reduce(p_day) + public.numerology_reduce(p_month) + public.numerology_reduce(p_year)
           );
    v_numbers := jsonb_build_array(jsonb_build_object('slot', 'main', 'number', v_row.number, 'title', v_row.title, 'description', v_row.description));

  elsif p_test_key = 'numerology_birthday' then
    select number, title, description into v_row from public.numerology_results
     where test_key = p_test_key and slot = 'main' and number = public.numerology_reduce(p_day);
    v_numbers := jsonb_build_array(jsonb_build_object('slot', 'main', 'number', v_row.number, 'title', v_row.title, 'description', v_row.description));

  elsif p_test_key = 'numerology_year' then
    select number, title, description into v_row from public.numerology_results
     where test_key = p_test_key and slot = 'main'
       and number = public.numerology_reduce(
             public.numerology_reduce(p_day, false) + public.numerology_reduce(p_month, false)
               + public.numerology_reduce(extract(year from current_date)::integer, false),
             false
           );
    v_numbers := jsonb_build_array(jsonb_build_object('slot', 'main', 'number', v_row.number, 'title', v_row.title, 'description', v_row.description));

  elsif p_test_key = 'numerology_challenge' then
    select number, title, description into v_row from public.numerology_results
     where test_key = p_test_key and slot = 'main'
       and number = abs(public.numerology_reduce(p_month, false) - public.numerology_reduce(p_day, false));
    v_numbers := jsonb_build_array(jsonb_build_object('slot', 'main', 'number', v_row.number, 'title', v_row.title, 'description', v_row.description));

  elsif p_test_key = 'numerology_cycles' then
    select coalesce(jsonb_agg(jsonb_build_object('slot', r.slot, 'number', r.number, 'title', r.title, 'description', r.description) order by ord), '[]'::jsonb)
      into v_numbers
      from (
        select 'formative' as slot, public.numerology_reduce(p_month, false) as number, 1 as ord
        union all
        select 'productive', public.numerology_reduce(p_day, false), 2
        union all
        select 'harvest', public.numerology_reduce(p_year, false), 3
      ) calc
      join public.numerology_results r
        on r.test_key = p_test_key and r.slot = calc.slot and r.number = calc.number;

  else
    raise exception 'TEST_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'test_key', v_test.key,
    'title',    v_test.title,
    'numbers',  v_numbers
  );
end $$;

revoke all on function public.compute_numerology(bigint, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.compute_numerology(bigint, text, integer, integer, integer) to service_role;
