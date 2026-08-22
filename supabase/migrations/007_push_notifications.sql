-- ============================================================
-- Пуш-уведомления через обычные сообщения Telegram-бота.
-- Три вида:
--   1) дуэль завершена соперником — уходит синхронно из finish_duel
--      (см. tg-api/index.ts), отдельного крона не требует;
--   2) напоминание о неотвеченном вызове на дуэль — гость 3+ часа
--      не принимает ссылку;
--   3) напоминание вернуться в игру — пользователь не заходил 24+ часа.
-- (2) и (3) собираются периодическим краном (см. tg-cron) через
-- get_duel_reminders / get_inactivity_reminders.
-- ============================================================

alter table public.duels add column if not exists reminded_at timestamptz;
alter table public.users add column if not exists last_nudge_at timestamptz;

-- ------------------------------------------------------------
-- finish_duel — та же логика, что в 001_init.sql, плюс 'notify':
-- когда этим вызовом исход дуэли определился (мы сыграли вторыми),
-- сообщаем, кого и о чём нужно уведомить. Сам Telegram API дёргает
-- Edge Function, а не Postgres — здесь только решение "кому" и "что".
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
-- get_duel_reminders — дуэли, которые никто не принял 3+ часа.
-- Атомарно помечает reminded_at, чтобы напоминание ушло 1 раз.
-- ------------------------------------------------------------
create or replace function public.get_duel_reminders(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  with candidates as (
    select id, host_tg_id
      from public.duels
     where status = 'pending'
       and guest_tg_id is null
       and reminded_at is null
       and created_at < now() - interval '3 hours'
     order by created_at
     limit p_limit
     for update skip locked
  ),
  marked as (
    update public.duels d
       set reminded_at = now()
      from candidates c
     where d.id = c.id
    returning d.id, d.host_tg_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('tg_id', host_tg_id, 'duel_id', id)), '[]'::jsonb)
    into v_result
    from marked;

  return v_result;
end $$;

-- ------------------------------------------------------------
-- get_inactivity_reminders — не заходили 24+ часа, давно не толкали.
-- Атомарно помечает last_nudge_at, чтобы не спамить чаще раза в сутки.
-- ------------------------------------------------------------
create or replace function public.get_inactivity_reminders(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  with candidates as (
    select tg_id, first_name
      from public.users
     where updated_at < now() - interval '24 hours'
       and (last_nudge_at is null or last_nudge_at < now() - interval '24 hours')
     order by updated_at
     limit p_limit
     for update skip locked
  ),
  marked as (
    update public.users u
       set last_nudge_at = now()
      from candidates c
     where u.tg_id = c.tg_id
    returning u.tg_id, u.first_name
  )
  select coalesce(jsonb_agg(jsonb_build_object('tg_id', tg_id, 'first_name', first_name)), '[]'::jsonb)
    into v_result
    from marked;

  return v_result;
end $$;

-- ------------------------------------------------------------
-- Права: только service_role, как и весь остальной API
-- ------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.get_duel_reminders(integer)',
    'public.get_inactivity_reminders(integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
