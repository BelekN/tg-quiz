-- ============================================================
-- Баг в finish_duel: условие "поставить дуэль completed + уведомить
-- соперника" было перевёрнуто — срабатывало, когда соперник ЕЩЁ НЕ
-- доиграл (v_opponent is null), а не когда он уже доиграл раньше меня
-- (что и предполагает комментарий тут же: "он доиграл первым").
--
-- Последствия в реальных данных:
--   1) Если соперник УЖЕ доиграл первым, а второй (я) финиширую и
--      ЕЩЁ НЕ дошёл до этой точки — условие ложно (v_opponent not null),
--      ветка не срабатывает вовсе -> status='completed' никогда не
--      проставляется, дуэль навсегда виснет в 'pending', хотя очки и
--      монеты обоим уже честно начислены (это считает отдельный блок
--      ниже, не связанный с этим багом).
--   2) Если гость успевает доиграть РАНЬШЕ хоста (join по ссылке до
--      того, как хост сыграл своим ходом) — при доигрывании гостя
--      условие истинно (host_score ещё null), функция пытается
--      проставить status='completed' с одним пустым счётом и падает на
--      check-constraint duels_completed_is_consistent (обнаружено при
--      живом тесте нового адресного вызова — тот же finish_duel, без
--      изменений, используется и старыми открытыми дуэлями).
--
-- Фикс — одна строка: условие должно проверять, что соперник УЖЕ
-- доиграл (v_opponent is not null), а не наоборот.
-- ============================================================

create or replace function public.finish_duel(p_tg_id bigint, p_duel_id uuid)
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

  -- ФИКС: было "v_opponent is null" — соперник УЖЕ доиграл первым
  -- (его счёт известен), а не наоборот.
  if v_opponent is not null and v_rival_id is not null then
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

revoke all on function public.finish_duel(bigint, uuid) from public, anon, authenticated;
grant execute on function public.finish_duel(bigint, uuid) to service_role;
