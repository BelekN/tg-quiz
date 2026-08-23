-- ============================================================
-- Набор точечных фиксов по итогам код-ревью:
--   1) deadlock в finish_duel при параллельных дуэлях между одной парой
--   2) неидемпотентные ADD CONSTRAINT (002, 009)
--   3) достижение "все категории" — зашитое число вместо реального счёта
--   4) явный revoke на старых таблицах, для консистентности с новыми
-- ============================================================

-- ------------------------------------------------------------
-- 1) finish_duel: детерминированный порядок блокировок строк users.
--
-- Раньше при outcome != pending обновляли сначала соперника (rival),
-- потом себя — в этом порядке. Если та же пара играет одновременно
-- вторую дуэль (например, реванш в обе стороны) и в НЕЙ роли хоста/
-- гостя зеркальные, вторая транзакция берёт блокировки в обратном
-- порядке (сперва "себя" по первой дуэли = "соперника" по второй) —
-- классический deadlock, Postgres откатывает одну из транзакций с
-- ошибкой "deadlock detected", и finish_duel у одного из игроков падает.
-- Фикс: перед любым обновлением строк users по обоим tg_id блокируем
-- их явно в порядке по tg_id — обе конкурентные транзакции берут
-- блокировки в одном и том же порядке и просто ждут друг друга, а не
-- зацикливаются.
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
  v_my_name  text;
  v_notify   jsonb;
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

    v_rival_id := case when v_role = 'host'
                       then v_duel.guest_tg_id
                       else v_duel.host_tg_id end;

    -- см. комментарий у миграции: фиксированный порядок блокировок
    -- по tg_id, чтобы параллельный finish_duel второй дуэли между
    -- той же парой не мог взять их в обратном порядке.
    perform 1 from public.users
     where tg_id in (p_tg_id, v_rival_id)
     order by tg_id
       for update;

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
    'outcome',        v_outcome,
    'notify',         v_notify
  );
end $$;

-- ------------------------------------------------------------
-- 2) Неидемпотентные ADD CONSTRAINT из 002 и 009 — при повторном
-- прогоне всех миграций с нуля падали с "constraint already exists",
-- хотя весь остальной набор явно заявлен как идемпотентный. Добавляем
-- те же constraint'ы через DO-блок с проверкой по pg_constraint —
-- аналогично тому, как 001_init.sql уже обрабатывает CREATE TYPE.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'questions_question_unique'
       and conrelid = 'public.questions'::regclass
  ) then
    alter table public.questions
      add constraint questions_question_unique unique (question);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'users_avatar_key_valid'
       and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_avatar_key_valid
      check (avatar_key is null or avatar_key in (
        'fox', 'owl', 'cat', 'robot', 'dragon',
        'panda', 'lion', 'octopus', 'alien', 'astronaut'
      ));
  end if;
end $$;

-- ------------------------------------------------------------
-- 3) Достижение "все категории" сравнивало count(distinct category)
-- с зашитым числом 10 — совпадает с реальным числом категорий сегодня
-- случайно; при добавлении/удалении категории тихо стало бы неверным
-- (разблокируется раньше времени или не разблокируется вовсе).
-- Сравниваем с реальным количеством активных категорий в questions.
-- ------------------------------------------------------------
create or replace function public.check_achievements(p_tg_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel_count     integer;
  v_win_count      integer := 0;
  v_streak         integer := 0;
  v_total_score    integer;
  v_categories     integer;
  v_all_categories integer;
  v_perfect        boolean;
  v_ace            boolean;
  v_keys           text[] := '{}';
  v_newly          jsonb;
begin
  select count(*) into v_duel_count
    from public.duels d
   where (d.host_tg_id = p_tg_id and d.host_score is not null)
      or (d.guest_tg_id = p_tg_id and d.guest_score is not null);

  with my_duels as (
    select
      coalesce(d.completed_at, d.created_at) as happened_at,
      case when d.host_tg_id = p_tg_id then d.host_score  else d.guest_score end as my_score,
      case when d.host_tg_id = p_tg_id then d.guest_score else d.host_score  end as opp_score
    from public.duels d
    where d.host_tg_id = p_tg_id or d.guest_tg_id = p_tg_id
  ),
  resolved as (
    select *, (my_score > opp_score) as is_win
      from my_duels
     where my_score is not null and opp_score is not null
  ),
  flagged as (
    select *,
      sum(case when not is_win then 1 else 0 end)
        over (order by happened_at desc) as loss_group
    from resolved
  )
  select
    coalesce(count(*) filter (where is_win), 0),
    coalesce(count(*) filter (where is_win and loss_group = 0), 0)
  into v_win_count, v_streak
  from flagged;

  select total_score into v_total_score from public.users where tg_id = p_tg_id;

  select count(distinct category) into v_categories
    from public.solo_sessions
   where tg_id = p_tg_id and status = 'completed' and category <> 'mixed';

  -- Раньше сравнивалось с зашитым числом 10 — совпадало с реальным
  -- количеством категорий случайно. Теперь считаем его от факта.
  select count(distinct category) into v_all_categories
    from public.questions
   where category <> 'mixed';

  select exists (
    select 1
      from public.solo_sessions s
     where s.tg_id = p_tg_id and s.status = 'completed'
       and (select count(*) from public.solo_answers sa
             where sa.session_id = s.id and sa.is_correct)
           = array_length(s.question_ids, 1)
  ) into v_perfect;

  select exists (
    select 1
      from public.sprint_sessions sp
     where sp.tg_id = p_tg_id and sp.status = 'completed'
       and (select count(*) from public.sprint_answers pa
             where pa.session_id = sp.id and pa.is_correct) >= 20
  ) into v_ace;

  if v_duel_count >= 1                       then v_keys := array_append(v_keys, 'first_duel');     end if;
  if v_win_count >= 10                       then v_keys := array_append(v_keys, 'duel_wins_10');   end if;
  if v_streak >= 3                           then v_keys := array_append(v_keys, 'win_streak_3');   end if;
  if v_perfect                                then v_keys := array_append(v_keys, 'perfect_solo');   end if;
  if v_ace                                    then v_keys := array_append(v_keys, 'sprint_ace');     end if;
  if v_all_categories > 0 and v_categories >= v_all_categories then
    v_keys := array_append(v_keys, 'all_categories');
  end if;
  if coalesce(v_total_score, 0) >= 5000       then v_keys := array_append(v_keys, 'score_5000');     end if;

  with ins as (
    insert into public.user_achievements (tg_id, achievement_key)
    select p_tg_id, k from unnest(v_keys) as k
    on conflict (tg_id, achievement_key) do nothing
    returning achievement_key
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'key', a.key, 'title', a.title, 'description', a.description, 'icon', a.icon
         )), '[]'::jsonb)
    into v_newly
    from ins join public.achievements a on a.key = ins.achievement_key;

  return v_newly;
end $$;

-- ------------------------------------------------------------
-- 4) Явный revoke на исходных таблицах — консистентность с тем, что
-- уже сделано для rate_limits/events/user_achievements. RLS без политик
-- уже запрещает всё для anon/authenticated, это доп. слой защиты на
-- случай, если RLS на какой-то таблице по ошибке отключат в будущем.
-- ------------------------------------------------------------
revoke all on table public.users, public.questions, public.duels, public.duel_answers,
  public.solo_sessions, public.solo_answers, public.sprint_sessions, public.sprint_answers
  from public, anon, authenticated;
