-- ============================================================
-- Код-ревью всей кодовой базы (после раздела "Нумерология"):
-- фиксы гонок при покупке и невалидных дат, найденные ревью.
--
-- 1. buy_persona_category / buy_numerology_test — TOCTOU race:
--    "уже разблокировано?" проверялось отдельным select ДО атомарного
--    update. Два параллельных запроса на один и тот же платный
--    раздел/тест оба проходили эту проверку (ни один ещё не закоммитил
--    unlocked_*), и оба списывали монеты — двойное списание за одну
--    покупку. Фикс: условие "ещё не разблокировано" переносится в
--    WHERE того же атомарного UPDATE, который уже проверяет баланс —
--    блокировка строки на время самого UPDATE сериализует конкурентные
--    попытки, вторая переоценивает WHERE против уже закоммиченного
--    состояния первой и просто не находит строку.
-- 2. compute_numerology — day/month проверялись независимо друг от
--    друга (day in [1,31], month in [1,12]), поэтому невозможные даты
--    вроде 30 февраля или 31 апреля проходили и считался результат
--    для даты, которой не существует. Фикс: make_date() сам знает
--    длину месяца и високосные годы — ловим его исключение как
--    INVALID_DATE вместо ручной таблицы длин месяцев.
-- 3. admin_credit_coins — coin_adjustments.amount писал сырой
--    p_amount, а не реально применённую разницу после отсечки в нуль
--    (greatest(0, coins + p_amount)). Списание с баланса 10 на -50
--    реально меняло баланс на -10, но в лог уходило -50 — искажение
--    истории при разборе. Фикс: считаем и логируем именно applied-delta.
-- ============================================================

create or replace function public.buy_persona_category(
  p_tg_id    bigint,
  p_category text
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
    from public.persona_tests
   where category = p_category and price_coins > 0
   order by ord
   limit 1;

  if v_price is null then
    raise exception 'NOT_PAID_CATEGORY';
  end if;

  update public.users
     set coins = coins - v_price,
         unlocked_persona_categories = array_append(coalesce(unlocked_persona_categories, '{}'), p_category),
         updated_at = now()
   where tg_id = p_tg_id
     and coins >= v_price
     and not (p_category = any(coalesce(unlocked_persona_categories, '{}')))
  returning * into v_user;

  if not found then
    if exists (
      select 1 from public.users
       where tg_id = p_tg_id and p_category = any(coalesce(unlocked_persona_categories, '{}'))
    ) then
      raise exception 'ALREADY_UNLOCKED';
    end if;
    raise exception 'NOT_ENOUGH_COINS';
  end if;

  return jsonb_build_object('user', to_jsonb(v_user), 'category', p_category);
end $$;

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

  update public.users
     set coins = coins - v_price,
         unlocked_numerology_tests = array_append(coalesce(unlocked_numerology_tests, '{}'), p_test_key),
         updated_at = now()
   where tg_id = p_tg_id
     and coins >= v_price
     and not (p_test_key = any(coalesce(unlocked_numerology_tests, '{}')))
  returning * into v_user;

  if not found then
    if exists (
      select 1 from public.users
       where tg_id = p_tg_id and p_test_key = any(coalesce(unlocked_numerology_tests, '{}'))
    ) then
      raise exception 'ALREADY_UNLOCKED';
    end if;
    raise exception 'NOT_ENOUGH_COINS';
  end if;

  return jsonb_build_object('user', to_jsonb(v_user), 'test_key', p_test_key);
end $$;

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

  -- День/месяц по отдельности проверены выше (диапазоны 1-31/1-12), но
  -- этого не хватает: 30 февраля или 31 апреля проходили бы как валидные.
  -- make_date() сам знает длину месяца и учитывает високосные годы —
  -- ловим его ошибку вместо ручной таблицы длин месяцев.
  begin
    perform make_date(p_year, p_month, p_day);
  exception when others then
    raise exception 'INVALID_DATE';
  end;

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

create or replace function public.admin_credit_coins(
  p_tg_id  bigint,
  p_amount integer,
  p_reason text default null
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      public.users;
  v_old_coins integer;
  v_applied   integer;
begin
  -- Блокируем строку и запоминаем баланс ДО начисления — иначе после
  -- отсечки greatest(0, ...) нечем посчитать реально применённую
  -- разницу для аудита (см. ниже).
  select coins into v_old_coins from public.users where tg_id = p_tg_id for update;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  update public.users
     -- greatest(0, ...) — если по ошибке ушли в минус, баланс просто
     -- дойдёт до нуля, а не упадёт в constraint-ошибку (coins >= 0).
     set coins = greatest(0, v_old_coins + p_amount), updated_at = now()
   where tg_id = p_tg_id
  returning * into v_user;

  -- В coin_adjustments.amount пишем реально применённую разницу, а не
  -- сырой p_amount: списание с баланса 10 на -50 меняет баланс лишь на
  -- -10 (отсечка в ноль) — лог должен отражать факт, а не запрос.
  v_applied := v_user.coins - v_old_coins;

  insert into public.coin_adjustments (tg_id, amount, reason)
  values (p_tg_id, v_applied, p_reason);

  return v_user;
end $$;
