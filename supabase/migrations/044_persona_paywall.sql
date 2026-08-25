-- ============================================================
-- Платные разделы в "Узнай себя": «Психология» и «Отношения» — за
-- монеты, покупка целого раздела разом (5 тестов), не по одному.
-- Остальные разделы (Поп-культура, Стиль жизни, Другое) остаются
-- бесплатными — воронка/крючок для новых пользователей.
--
-- Разблокировка — простой text[] на users, не отдельная таблица:
-- разделов мало (кардинальность низкая), джойн не нужен — тот же
-- принцип, что у equipped_frame/streak_freezes (простые колонки
-- вместо таблицы там, где сущностей мало).
-- ============================================================

alter table public.persona_tests add column if not exists price_coins integer
  not null default 0 check (price_coins >= 0);

alter table public.users add column if not exists unlocked_persona_categories text[]
  not null default '{}';

update public.persona_tests set price_coins = 600
 where category in ('Психология', 'Отношения');

-- ------------------------------------------------------------
-- get_persona_tests — с p_tg_id: без него нельзя посчитать, что уже
-- разблокировано именно для этого игрока. Сигнатура меняется (было
-- без параметров) — старую версию сначала дропаем, иначе получим
-- неоднозначную перегрузку вместо замены.
-- ------------------------------------------------------------
drop function if exists public.get_persona_tests();

create or replace function public.get_persona_tests(p_tg_id bigint)
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
  select coalesce(unlocked_persona_categories, '{}') into v_unlocked
    from public.users where tg_id = p_tg_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'key',         key,
           'title',       title,
           'description', description,
           'icon',        icon,
           'category',    category,
           'price_coins', price_coins,
           'unlocked',    price_coins = 0 or category = any(coalesce(v_unlocked, '{}'))
         ) order by ord), '[]'::jsonb)
    into v_result
    from public.persona_tests
   where is_active;

  return v_result;
end $$;

revoke all on function public.get_persona_tests(bigint) from public, anon, authenticated;
grant execute on function public.get_persona_tests(bigint) to service_role;

-- ------------------------------------------------------------
-- buy_persona_category — покупка целого платного раздела разом.
-- ------------------------------------------------------------
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
   limit 1;

  if v_price is null then
    raise exception 'NOT_PAID_CATEGORY';
  end if;

  if exists (
    select 1 from public.users
     where tg_id = p_tg_id and p_category = any(coalesce(unlocked_persona_categories, '{}'))
  ) then
    raise exception 'ALREADY_UNLOCKED';
  end if;

  update public.users
     set coins = coins - v_price,
         unlocked_persona_categories = array_append(coalesce(unlocked_persona_categories, '{}'), p_category),
         updated_at = now()
   where tg_id = p_tg_id and coins >= v_price
  returning * into v_user;

  if not found then
    raise exception 'NOT_ENOUGH_COINS';
  end if;

  return jsonb_build_object('user', to_jsonb(v_user), 'category', p_category);
end $$;

revoke all on function public.buy_persona_category(bigint, text) from public, anon, authenticated;
grant execute on function public.buy_persona_category(bigint, text) to service_role;

-- ------------------------------------------------------------
-- start_persona — переиздана: единственное изменение против версии
-- из 023_persona_fixes.sql — проверка разблокировки платного раздела
-- перед стартом (защита на случай, если клиент как-то обойдёт
-- проверку в UI — сервер всё равно источник истины). Всё остальное,
-- включая order by random() у вариантов (см. 023 — так и было
-- сделано, чтобы порядок не угадывался по позиции), не тронуто.
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
  v_unlocked  text[];
begin
  select * into v_test from public.persona_tests where key = p_test_key;
  if not found then
    raise exception 'TEST_NOT_FOUND';
  end if;

  if v_test.price_coins > 0 then
    select coalesce(unlocked_persona_categories, '{}') into v_unlocked
      from public.users where tg_id = p_tg_id;
    if not (v_test.category = any(v_unlocked)) then
      raise exception 'NOT_UNLOCKED';
    end if;
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
                        ) order by random()
                      )
                 from public.persona_options o
                where o.question_id = q.id
             )
           ) order by q.ord
         )
    into v_questions
    from public.persona_questions q
   where q.test_key = p_test_key;

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

revoke all on function public.start_persona(bigint, text) from public, anon, authenticated;
grant execute on function public.start_persona(bigint, text) to service_role;
