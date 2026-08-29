-- ============================================================
-- Рейтинг обнуляется каждую неделю. total_score (ранги, достижение
-- "набери 5000 очков", профиль) НЕ трогаем — он остаётся пожизненным
-- прогрессом. Рейтинг переводим на отдельный weekly_score, который
-- растёт синхронно с total_score в каждом finish_* и обнуляется
-- pg_cron'ом каждый понедельник в 00:00 UTC (~06:00 Бишкек).
-- ============================================================

alter table public.users add column if not exists weekly_score integer not null default 0;

-- ------------------------------------------------------------
-- finish_duel — та же функция, что в 020_fixes.sql, плюс
-- weekly_score растёт вместе с total_score.
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

  v_coins := 5 * v_correct;

  if v_opponent is not null then
    v_outcome := case
                    when v_score > v_opponent then 'win'
                    when v_score < v_opponent then 'lose'
                    else 'draw'
                  end;
    v_coins := v_coins + case v_outcome when 'win' then 20 when 'draw' then 10 else 0 end;
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
-- finish_solo — та же функция, что в 005_solo_quiz.sql, плюс
-- weekly_score.
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

  v_coins := v_correct * 5;

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
-- finish_sprint — та же функция, что в 006_sprint.sql, плюс
-- weekly_score.
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

  v_coins := v_correct * 3;

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
-- finish_daily — та же функция, что в 033_daily_challenge.sql, плюс
-- weekly_score.
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

  v_coins := v_correct * 5;

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
-- finish_marathon — та же функция, что в 034_marathon.sql, плюс
-- weekly_score.
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
  v_coins := v_correct * 5;

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

-- ------------------------------------------------------------
-- get_leaderboard — теперь сортирует и показывает weekly_score
-- (то, что обнуляется каждую неделю), total_score отдаём тоже —
-- пригодится, если понадобится показать пожизненный счёт рядом.
-- ------------------------------------------------------------
create or replace function public.get_leaderboard(
  p_tg_id  bigint,
  p_limit  integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_top jsonb;
  v_me  jsonb;
begin
  select jsonb_agg(t) into v_top
    from (
      select
        row_number() over (order by weekly_score desc, tg_id asc) as rank,
        tg_id, username, first_name, photo_url, avatar_key, equipped_frame, equipped_badge,
        city, weekly_score, total_score, coins
      from public.users
      order by weekly_score desc, tg_id asc
      limit p_limit
    ) t;

  select to_jsonb(r) into v_me
    from (
      select
        row_number() over (order by weekly_score desc, tg_id asc) as rank,
        tg_id, username, first_name, photo_url, avatar_key, equipped_frame, equipped_badge,
        city, weekly_score, total_score, coins
      from public.users
    ) r
   where r.tg_id = p_tg_id;

  return jsonb_build_object(
    'top', coalesce(v_top, '[]'::jsonb),
    'me',  v_me
  );
end $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.finish_duel(bigint, uuid)',
    'public.finish_solo(bigint, uuid)',
    'public.finish_sprint(bigint, uuid)',
    'public.finish_daily(bigint, uuid)',
    'public.finish_marathon(bigint, uuid)',
    'public.get_leaderboard(bigint, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Еженедельный сброс — каждый понедельник в 00:00 UTC (~06:00 по
-- Бишкеку). Идемпотентно: unschedule перед schedule, как в
-- 011_cron_schedule.sql, чтобы повторный прогон не плодил дубликаты.
-- Чистая SQL-задача, без похода во внешний API — pg_cron дёргает
-- функцию напрямую, tg-cron тут не нужен.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'weekly-leaderboard-reset') then
    perform cron.unschedule('weekly-leaderboard-reset');
  end if;
end $$;

select cron.schedule(
  'weekly-leaderboard-reset',
  '0 0 * * 1',
  $job$ update public.users set weekly_score = 0 where weekly_score <> 0; $job$
);
