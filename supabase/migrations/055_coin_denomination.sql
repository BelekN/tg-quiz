-- ============================================================
-- Денонимация монет: старые суммы (700-1800 за рамку/титул, до 5500
-- за пачку монет) визуально читались как настоящие деньги — легко
-- принять "1500 монет" за "1500 сом/рублей" и напугаться, хотя это
-- просто мягкая внутриигровая валюта. Пересчитываем весь баланс монет
-- к масштабу "1 монета ≈ 1 сом/рубль": курс Stars фиксируем как
-- 1 Star = 2 монеты (при условном курсе 1 Star ≈ 2 сом/рубля — те же
-- деньги, только некрупные числа).
--
-- Коэффициент — ÷5 везде, где раньше он давал целое число (награды
-- 5/correct и все цены в магазине/тестах кратны 5) — так соотношение
-- "сколько партий, чтобы накопить на рамку" не меняется:
-- было 700 монет / 5 монет за верный ответ = 140 верных ответов;
-- стало 140 монет / 1 монета за верный ответ = те же 140.
-- Спринт (было 3/correct) — единственное исключение: 3 не делится на
-- 5 без остатка, оставляем ту же 1 монету за верный ответ, что и у
-- остальных режимов, ради простоты и единообразия (было чуть меньше
-- монет за верный ответ в спринте — теперь как у всех).
--
-- Существующие балансы игроков ТОЖЕ пересчитываем (round(coins/5.0)) —
-- иначе те, кто уже накопил монет по старому курсу, получили бы
-- пятикратный виндфол относительно новых цен. coin_adjustments и
-- star_purchases — исторический журнал, не трогаем: это запись о том,
-- что произошло тогда, а не текущий баланс.
-- ============================================================

update public.users set coins = round(coins / 5.0) where coins > 0;

-- ------------------------------------------------------------
-- Магазин — цены ÷5 у всех товаров (см. 054_shop_more_items.sql).
-- ------------------------------------------------------------
update public.cosmetic_items set price_coins = round(price_coins / 5.0)
 where price_coins > 0;

-- ------------------------------------------------------------
-- "Узнай себя" — платные категории (см. 044_persona_paywall.sql).
-- ------------------------------------------------------------
update public.persona_tests set price_coins = round(price_coins / 5.0)
 where price_coins > 0;

-- ------------------------------------------------------------
-- Нумерология — платные тесты (см. 047_numerology.sql).
-- ------------------------------------------------------------
update public.numerology_tests set price_coins = round(price_coins / 5.0)
 where price_coins > 0;

-- ------------------------------------------------------------
-- finish_duel — та же функция, что в 051_weekly_leaderboard.sql,
-- коины: 5/correct -> 1/correct, бонус за победу/ничью 20/10 -> 4/2
-- (и себе, и сопернику при отложенном начислении).
-- ------------------------------------------------------------
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
  v_duel      public.duels;
  v_role      text;
  v_correct   integer;
  v_total     integer;
  v_score     integer;
  v_coins     integer;
  v_balance   integer;
  v_opponent  integer;
  v_outcome   text;
  v_rival_id  bigint;
  v_my_name   text;
  v_notify    jsonb := null;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then raise exception 'DUEL_NOT_FOUND'; end if;

  if v_duel.host_tg_id = p_tg_id then
    v_role := 'host';
  elsif v_duel.guest_tg_id = p_tg_id then
    v_role := 'guest';
  else
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  if (v_role = 'host' and v_duel.host_score is not null)
     or (v_role = 'guest' and v_duel.guest_score is not null) then
    raise exception 'ALREADY_PLAYED';
  end if;

  v_total := 5;

  select count(*) filter (where is_correct), coalesce(sum(points), 0)
    into v_correct, v_score
    from public.duel_answers
   where duel_id = p_duel_id and tg_id = p_tg_id;

  if v_role = 'host' then
    update public.duels set host_score = v_score where id = p_duel_id;
    v_opponent := v_duel.guest_score;
    v_rival_id := v_duel.guest_tg_id;
  else
    update public.duels set guest_score = v_score where id = p_duel_id;
    v_opponent := v_duel.host_score;
    v_rival_id := v_duel.host_tg_id;
  end if;

  v_coins := 1 * v_correct;

  if v_opponent is not null then
    v_outcome := case
                    when v_score > v_opponent then 'win'
                    when v_score < v_opponent then 'lose'
                    else 'draw'
                  end;
    v_coins := v_coins + case v_outcome when 'win' then 4 when 'draw' then 2 else 0 end;
  else
    v_outcome := 'pending';
  end if;

  if v_opponent is null and v_rival_id is not null then
    -- см. комментарий у миграции: фиксированный порядок блокировок
    -- по tg_id, чтобы параллельный finish_duel второй дуэли между
    -- той же парой не мог взять их в обратном порядке.
    perform 1 from public.users
     where tg_id in (p_tg_id, v_rival_id)
     order by tg_id
       for update;

    if v_outcome = 'lose' then
      update public.users set coins = coins + 4, updated_at = now()
       where tg_id = v_rival_id;
    elsif v_outcome = 'draw' then
      update public.users set coins = coins + 2, updated_at = now()
       where tg_id = v_rival_id;
    end if;

    update public.duels
       set status = 'completed', completed_at = now()
     where id = v_duel.id;

    select first_name into v_my_name from public.users where tg_id = p_tg_id;

    -- сообщаем сопернику: он доиграл первым, поэтому исход для НЕГО
    -- обратный тому, что мы только что посчитали для себя
    v_notify := jsonb_build_object(
      'tg_id',             v_rival_id,
      'duel_id',           v_duel.id,
      'finisher_name',     coalesce(v_my_name, 'Соперник'),
      'rival_score',       v_opponent,
      'finisher_score',    v_score,
      'outcome_for_rival', case v_outcome
                              when 'win'  then 'lose'
                              when 'lose' then 'win'
                              else 'draw'
                            end
    );
  end if;

  update public.users
     set total_score  = total_score + v_score,
         weekly_score = weekly_score + v_score,
         coins        = coins + v_coins,
         updated_at   = now()
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
    'outcome',        v_outcome,
    'notify',         v_notify
  );
end $$;

-- ------------------------------------------------------------
-- finish_solo — коины: 5/correct -> 1/correct.
-- ------------------------------------------------------------
create or replace function public.finish_solo(
  p_tg_id      bigint,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session  public.solo_sessions;
  v_total    integer;
  v_answered integer;
  v_correct  integer;
  v_score    integer;
  v_coins    integer;
  v_balance  integer;
begin
  select * into v_session from public.solo_sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.tg_id <> p_tg_id then raise exception 'NOT_A_PARTICIPANT'; end if;
  if v_session.status = 'completed' then raise exception 'ALREADY_COMPLETED'; end if;

  v_total := array_length(v_session.question_ids, 1);

  select count(*), count(*) filter (where is_correct), coalesce(sum(points), 0)
    into v_answered, v_correct, v_score
    from public.solo_answers where session_id = p_session_id;

  if v_answered <> v_total then
    raise exception 'INCOMPLETE_SESSION';
  end if;

  v_coins := v_correct * 1;

  update public.solo_sessions
     set status = 'completed', score = v_score, coins_earned = v_coins, completed_at = now()
   where id = p_session_id;

  update public.users
     set total_score  = total_score + v_score,
         weekly_score = weekly_score + v_score,
         coins        = coins + v_coins,
         updated_at   = now()
   where tg_id = p_tg_id
  returning coins into v_balance;

  return jsonb_build_object(
    'session_id',    p_session_id,
    'category',      v_session.category,
    'correct',       v_correct,
    'total',         v_total,
    'score',         v_score,
    'coins_earned',  v_coins,
    'coins_balance', v_balance
  );
end $$;

-- ------------------------------------------------------------
-- finish_sprint — коины: 3/correct -> 1/correct (единственный режим,
-- где коэффициент не был кратен 5 — см. комментарий у миграции).
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

  v_coins := v_correct * 1;

  update public.sprint_sessions
     set status = 'completed', score = v_score, coins_earned = v_coins, completed_at = now()
   where id = p_session_id;

  update public.users
     set total_score  = total_score + v_score,
         weekly_score = weekly_score + v_score,
         coins        = coins + v_coins,
         updated_at   = now()
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
-- finish_daily — коины: 5/correct -> 1/correct.
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

  v_coins := v_correct * 1;

  update public.daily_sessions
     set status = 'completed', score = v_score, coins_earned = v_coins, completed_at = now()
   where id = p_session_id;

  update public.users
     set total_score  = total_score + v_score,
         weekly_score = weekly_score + v_score,
         coins        = coins + v_coins,
         updated_at   = now()
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
-- finish_marathon — коины: 5/correct -> 1/correct.
-- ------------------------------------------------------------
create or replace function public.finish_marathon(
  p_tg_id      bigint,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session    public.marathon_sessions;
  v_total_pool integer;
  v_answered   integer;
  v_correct    integer;
  v_has_wrong  boolean;
  v_score      integer;
  v_coins      integer;
  v_balance    integer;
  v_record     integer;
begin
  select * into v_session from public.marathon_sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.tg_id <> p_tg_id then raise exception 'NOT_A_PARTICIPANT'; end if;
  if v_session.status = 'completed' then raise exception 'ALREADY_COMPLETED'; end if;

  v_total_pool := array_length(v_session.question_ids, 1);

  select count(*), count(*) filter (where is_correct)
    into v_answered, v_correct
    from public.marathon_answers where session_id = p_session_id;

  v_has_wrong := v_answered > v_correct;

  if not v_has_wrong and v_answered < v_total_pool then
    raise exception 'MARATHON_NOT_OVER';
  end if;

  v_score := v_correct * 100;
  v_coins := v_correct * 1;

  update public.marathon_sessions
     set status = 'completed', score = v_score, coins_earned = v_coins, completed_at = now()
   where id = p_session_id;

  update public.users
     set total_score              = total_score + v_score,
         weekly_score              = weekly_score + v_score,
         coins                    = coins + v_coins,
         longest_marathon_streak  = greatest(longest_marathon_streak, v_correct),
         updated_at               = now()
   where tg_id = p_tg_id
  returning coins, longest_marathon_streak into v_balance, v_record;

  return jsonb_build_object(
    'session_id',    p_session_id,
    'correct',       v_correct,
    'score',         v_score,
    'coins_earned',  v_coins,
    'coins_balance', v_balance,
    'best_streak',   v_record
  );
end $$;
