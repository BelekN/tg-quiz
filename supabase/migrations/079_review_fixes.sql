-- ============================================================
-- Исправления по полному код-ревью (2026-10-02). Каждый блок — одна
-- находка; текущие определения функций взяты из прода и поправлены
-- точечно.
-- ============================================================

-- ---- 1. Права: Supabase по умолчанию раздаёт anon/authenticated всё
-- на новые таблицы/последовательности/функции — 073 включил RLS на
-- referrals, но табличные гранты (включая TRUNCATE, который RLS не
-- покрывает) остались. Закрываем их и меняем default privileges, чтобы
-- следующая таблица не повторила историю.
revoke all on table public.referrals from public, anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- ---- 2. start_duel: в адресный вызов мог войти кто угодно по утёкшему
-- duel_id, отклонённый — доиграть; плюс лимиты на спам вызовами.
CREATE OR REPLACE FUNCTION public.start_duel(p_tg_id bigint, p_duel_id uuid DEFAULT NULL::uuid, p_questions_count integer DEFAULT 5, p_target_tg_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_duel      public.duels;
  v_role      text;
  v_ids       uuid[];
  v_questions jsonb;
  v_answered  integer;
  v_correct   integer;
begin
  if p_duel_id is null then
    -- ---- ХОСТ: набираем случайные вопросы ----
    if p_target_tg_id is not null then
      if p_target_tg_id = p_tg_id then
        raise exception 'CANNOT_CHALLENGE_SELF';
      end if;
      if not exists (select 1 from public.users where tg_id = p_target_tg_id) then
        raise exception 'USER_NOT_FOUND';
      end if;
      -- Анти-спам адресными вызовами (каждый — пуш цели): один висящий
      -- вызов на пару и не больше 10 вызовов в час от одного игрока.
      if exists (
        select 1 from public.duels
         where host_tg_id = p_tg_id and invited_tg_id = p_target_tg_id and status = 'invited'
      ) then
        raise exception 'ALREADY_CHALLENGED';
      end if;
      if (select count(*) from public.duels
           where host_tg_id = p_tg_id and invited_tg_id is not null
             and created_at > now() - interval '1 hour') >= 10 then
        raise exception 'CHALLENGE_RATE_LIMITED';
      end if;
    end if;

    select array_agg(q.id) into v_ids
      from (
        select id from public.questions
        where is_active
        order by random()
        limit p_questions_count
      ) q;

    if coalesce(array_length(v_ids, 1), 0) < p_questions_count then
      raise exception 'NOT_ENOUGH_QUESTIONS';
    end if;

    insert into public.duels (host_tg_id, question_ids, invited_tg_id, status)
    values (
      p_tg_id, v_ids, p_target_tg_id,
      (case when p_target_tg_id is not null then 'invited' else 'pending' end)::duel_status
    )
    returning * into v_duel;

    v_role := 'host';
  else
    select * into v_duel from public.duels where id = p_duel_id for update;
    if not found then
      raise exception 'DUEL_NOT_FOUND';
    end if;

    if v_duel.host_tg_id = p_tg_id then
      -- хост возвращается в свою же дуэль (например, после сетевой
      -- ошибки посреди игры) — это не переигровка, answered/correct
      -- ниже и так не дадут ответить на уже пройденные вопросы.
      v_role := 'host';
    else
      if v_duel.status = 'completed' then
        raise exception 'DUEL_ALREADY_COMPLETED';
      end if;
      if v_duel.status = 'declined' then
        raise exception 'DUEL_DECLINED';
      end if;
      -- Адресный вызов: войти может только приглашённый, и вход по
      -- ссылке = неявное принятие (иначе статус остался бы 'invited', и
      -- крон 068 удалил бы дуэль посреди игры).
      if v_duel.status = 'invited' then
        if v_duel.invited_tg_id is distinct from p_tg_id then
          raise exception 'DUEL_ALREADY_TAKEN';
        end if;
        update public.duels set status = 'pending'
         where id = v_duel.id
        returning * into v_duel;
      end if;

      if v_duel.guest_tg_id is not null and v_duel.guest_tg_id <> p_tg_id then
        raise exception 'DUEL_ALREADY_TAKEN';
      end if;

      if v_duel.guest_tg_id is null then
        update public.duels set guest_tg_id = p_tg_id
         where id = v_duel.id
        returning * into v_duel;
      end if;

      v_role := 'guest';
    end if;
  end if;

  -- Сколько уже отвечено? Игрок мог закрыть приложение на
  -- середине — тогда продолжаем с того же вопроса, а не с нуля
  -- (иначе answer_question вернёт OUT_OF_ORDER_ANSWER).
  select count(*), count(*) filter (where is_correct)
    into v_answered, v_correct
    from public.duel_answers
   where duel_id = v_duel.id and tg_id = p_tg_id;

  if v_answered >= array_length(v_duel.question_ids, 1) then
    raise exception 'ALREADY_PLAYED';
  end if;

  -- порядок вопросов = порядок в question_ids, а не порядок из БД
  select jsonb_agg(
           jsonb_build_object(
             'id',       q.id,
             'question', q.question,
             'options',  public.shuffle_options(q.options, v_duel.id::text || ':' || q.id::text),
             'category', q.category
           ) order by t.ord
         )
    into v_questions
    from unnest(v_duel.question_ids) with ordinality as t(qid, ord)
    join public.questions q on q.id = t.qid;

  return jsonb_build_object(
    'duel_id',   v_duel.id,
    'role',      v_role,
    'status',    v_duel.status,
    'questions', v_questions,
    -- с какого вопроса продолжать (0 для новой дуэли)
    'answered',  v_answered,
    'correct',   v_correct
  );
end $function$;

-- ---- 3. accept_duel_challenge: не перезаписывать уже севшего гостя.
CREATE OR REPLACE FUNCTION public.accept_duel_challenge(p_tg_id bigint, p_duel_id uuid)
 RETURNS duels
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_duel public.duels;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then raise exception 'DUEL_NOT_FOUND'; end if;
  if v_duel.invited_tg_id is distinct from p_tg_id or v_duel.status <> 'invited'
     or (v_duel.guest_tg_id is not null and v_duel.guest_tg_id <> p_tg_id) then
    raise exception 'NOT_INVITED';
  end if;

  update public.duels
     set guest_tg_id = p_tg_id, status = 'pending'
   where id = p_duel_id
  returning * into v_duel;

  return v_duel;
end $function$;

-- ---- 4. answer_question: бонус за скорость больше не берётся на веру.
CREATE OR REPLACE FUNCTION public.answer_question(p_tg_id bigint, p_duel_id uuid, p_index integer, p_answer smallint, p_elapsed_ms integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_duel     public.duels;
  v_expected integer;
  v_qid      uuid;
  v_options  text[];
  v_right    smallint;
  v_shuffled_right smallint;
  v_correct  boolean;
  v_elapsed  integer;
  v_points   integer := 0;
  v_seed     text;
  v_prev_at  timestamptz;
  v_min_ms   integer := 0;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then
    raise exception 'DUEL_NOT_FOUND';
  end if;

  if p_tg_id <> v_duel.host_tg_id
     and p_tg_id <> coalesce(v_duel.guest_tg_id, -1) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  if p_index < 0 or p_index >= array_length(v_duel.question_ids, 1) then
    raise exception 'BAD_QUESTION_INDEX';
  end if;

  select count(*) into v_expected
    from public.duel_answers
   where duel_id = p_duel_id and tg_id = p_tg_id;

  if p_index <> v_expected then
    raise exception 'OUT_OF_ORDER_ANSWER';
  end if;

  v_qid := v_duel.question_ids[p_index + 1];  -- массивы в PG 1-based
  select options, correct_option_index into v_options, v_right
    from public.questions where id = v_qid;

  v_seed := p_duel_id::text || ':' || v_qid::text;
  v_shuffled_right := public.shuffled_correct_index(v_options, v_seed, v_right);

  -- Время приходит с клиента — ограничиваем его снизу серверным: между
  -- двумя ответами проходит пауза показа ответа (REVEAL_MS = 1100 в
  -- QuizScreen) + время на размышление + сеть туда-обратно. Запас 2600
  -- мс покрывает паузу и сеть, так что честный клиент не пострадает, а
  -- «всегда 0 мс» больше не даёт максимум очков за вопросы 2–5. Для
  -- первого вопроса опорной точки нет (между стартом и ним — экран
  -- правил), там остаётся клиентское значение.
  if p_index > 0 then
    select max(created_at) into v_prev_at
      from public.duel_answers where duel_id = p_duel_id and tg_id = p_tg_id;
    v_min_ms := greatest(0, (extract(epoch from (now() - v_prev_at)) * 1000)::int - 2600);
  end if;
  v_elapsed := least(greatest(coalesce(p_elapsed_ms, 10000), v_min_ms, 0), 10000);
  v_correct := p_answer is not null and p_answer = v_shuffled_right;

  if v_correct then
    -- 100 за правильный ответ + до 100 бонуса за скорость
    v_points := 100 + ((10000 - v_elapsed) / 100);
  end if;

  insert into public.duel_answers (
    duel_id, tg_id, question_index, question_id,
    answer_index, is_correct, elapsed_ms, points
  )
  values (
    p_duel_id, p_tg_id, p_index, v_qid,
    p_answer, v_correct, v_elapsed, v_points
  );

  return jsonb_build_object(
    'correct_option_index', v_shuffled_right,
    'is_correct',           v_correct,
    'points',               v_points
  );
end $function$;

-- ---- 5. start_daily: возобновление прерванного вызова.
CREATE OR REPLACE FUNCTION public.start_daily(p_tg_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ids       uuid[];
  v_session   public.daily_sessions;
  v_questions jsonb;
  v_answered  integer := 0;
  v_correct   integer := 0;
begin
  select array_agg(id) into v_ids
    from (
      select id from public.questions
       where is_active
       order by md5(current_date::text || ':' || id::text)
       limit 5
    ) q;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'NOT_ENOUGH_QUESTIONS';
  end if;

  begin
    insert into public.daily_sessions (tg_id, question_ids)
    values (p_tg_id, v_ids)
    returning * into v_session;
  exception when unique_violation then
    -- Сессия на сегодня уже есть. Если не завершена (сетевой сбой посреди
    -- вызова) — продолжаем её, а не сжигаем день целиком.
    select * into v_session from public.daily_sessions
     where tg_id = p_tg_id and play_date = current_date
     for update;
    if v_session.status = 'completed' then
      raise exception 'ALREADY_PLAYED_TODAY';
    end if;
    select count(*), count(*) filter (where is_correct)
      into v_answered, v_correct
      from public.daily_answers where session_id = v_session.id;
  end;

  select jsonb_agg(
           jsonb_build_object(
             'id',       q.id,
             'question', q.question,
             'options',  public.shuffle_options(q.options, v_session.play_date::text || ':' || q.id::text),
             'category', q.category
           ) order by t.ord
         )
    into v_questions
    from unnest(v_session.question_ids) with ordinality as t(qid, ord)
    join public.questions q on q.id = t.qid;

  return jsonb_build_object(
    'session_id', v_session.id,
    'play_date',  v_session.play_date,
    'questions',  v_questions,
    'answered',   v_answered,
    'correct',    v_correct
  );
end $function$;

-- ---- 6. upsert_user: под блокировкой — два параллельных входа больше
-- не списывают две заморозки за один пропущенный день.
CREATE OR REPLACE FUNCTION public.upsert_user(p_tg_id bigint, p_username text DEFAULT NULL::text, p_first_name text DEFAULT NULL::text, p_photo_url text DEFAULT NULL::text)
 RETURNS users
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user             public.users;
  v_prev_streak_date date;
  v_prev_streak      integer;
  v_prev_longest     integer;
  v_freezes_avail    integer;
  v_new_streak       integer;
  v_freeze_used      integer := 0;
begin
  select last_streak_date, current_streak, longest_streak, coalesce(streak_freezes, 0)
    into v_prev_streak_date, v_prev_streak, v_prev_longest, v_freezes_avail
    from public.users where tg_id = p_tg_id
     for update;

  if v_prev_streak_date is null then
    v_new_streak := 1;
  elsif v_prev_streak_date = current_date then
    v_new_streak := coalesce(v_prev_streak, 1);
  elsif v_prev_streak_date = current_date - 1 then
    v_new_streak := coalesce(v_prev_streak, 0) + 1;
  elsif v_prev_streak_date = current_date - 2 and v_freezes_avail > 0 then
    v_new_streak := coalesce(v_prev_streak, 0) + 1;
    v_freeze_used := 1;
  else
    v_new_streak := 1;
  end if;

  insert into public.users as u (
    tg_id, username, first_name, photo_url,
    current_streak, longest_streak, last_streak_date
  )
  values (
    p_tg_id, p_username, p_first_name, p_photo_url,
    v_new_streak, v_new_streak, current_date
  )
  on conflict (tg_id) do update
    set username         = coalesce(excluded.username,   u.username),
        first_name       = coalesce(excluded.first_name, u.first_name),
        photo_url        = coalesce(excluded.photo_url,  u.photo_url),
        updated_at       = now(),
        current_streak   = v_new_streak,
        longest_streak   = greatest(u.longest_streak, v_new_streak),
        last_streak_date = current_date,
        streak_freezes   = greatest(0, u.streak_freezes - v_freeze_used)
  returning * into v_user;

  return v_user;
end $function$;

-- ---- 7. claim_referral: только новые игроки, без взаимных приглашений.
CREATE OR REPLACE FUNCTION public.claim_referral(p_tg_id bigint, p_referrer_tg_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reward constant integer := 30;
  v_rows integer;
begin
  if p_tg_id = p_referrer_tg_id then
    raise exception 'SELF_REFERRAL';
  end if;

  if not exists (select 1 from public.users where tg_id = p_referrer_tg_id) then
    raise exception 'REFERRER_NOT_FOUND';
  end if;

  -- Награда — только за НОВОГО игрока: иначе любые два давних аккаунта
  -- «приглашали» друг друга и получали монеты (в т.ч. по кругу).
  if not exists (
    select 1 from public.users where tg_id = p_tg_id and created_at > now() - interval '48 hours'
  ) then
    raise exception 'NOT_NEW_USER';
  end if;
  if exists (
    select 1 from public.referrals where referrer_tg_id = p_tg_id and referred_tg_id = p_referrer_tg_id
  ) then
    raise exception 'MUTUAL_REFERRAL';
  end if;

  insert into public.referrals (referrer_tg_id, referred_tg_id)
  values (p_referrer_tg_id, p_tg_id)
  on conflict (referred_tg_id) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'ALREADY_REFERRED';
  end if;

  update public.users set coins = coins + v_reward where tg_id = p_referrer_tg_id;
  update public.users set coins = coins + v_reward where tg_id = p_tg_id;

  return jsonb_build_object('reward', v_reward);
end $function$;

-- ---- 8. answer_compat: нельзя менять ответы после завершения, индекс в диапазоне.
CREATE OR REPLACE FUNCTION public.answer_compat(p_tg_id bigint, p_session_id uuid, p_question_id uuid, p_option_index smallint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session      public.compat_sessions;
  v_was_completed boolean;
  v_total        integer;
  v_my_answered  integer;
  v_other_id     bigint;
  v_other_answered integer;
  v_match        integer;
  v_notify       jsonb := null;
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

  v_was_completed := v_session.status = 'completed';
  -- Ответы завершённой сессии больше не меняются: иначе, посмотрев
  -- ответы партнёра в разборе, можно было переписать свои на 100%.
  if v_was_completed then
    raise exception 'ALREADY_COMPLETED';
  end if;
  if p_option_index is null or p_option_index < 0
     or p_option_index >= (select count(*) from public.compat_options where question_id = p_question_id) then
    raise exception 'BAD_OPTION_INDEX';
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

      -- Уведомляем только того, кто ЭТИМ ответом узнал результат
      -- впервые (сам p_tg_id уже видит его в собственном ответе), и
      -- только если сессия ИМЕННО СЕЙЧАС завершилась — иначе повторный
      -- upsert уже отвеченного вопроса слал бы пуш заново.
      if not v_was_completed then
        v_notify := jsonb_build_object('tg_id', v_other_id, 'match_percent', v_match);
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'my_answered',       v_my_answered,
    'total',              v_total,
    'session_completed',  v_session.status = 'completed',
    'match_percent',      v_session.match_percent,
    'notify',             v_notify
  );
end $function$;

-- ---- 9. equip_frame: проверяем и владение, и тип предмета.
CREATE OR REPLACE FUNCTION public.equip_frame(p_tg_id bigint, p_item_key text)
 RETURNS users
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user public.users;
begin
  if p_item_key is not null and not exists (
    select 1 from public.user_cosmetics uc
      join public.cosmetic_items ci on ci.key = uc.item_key
     where uc.tg_id = p_tg_id and uc.item_key = p_item_key and ci.type = 'avatar_frame'
  ) then
    raise exception 'NOT_OWNED';
  end if;

  update public.users
     set equipped_frame = p_item_key, updated_at = now()
   where tg_id = p_tg_id
  returning * into v_user;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  return v_user;
end $function$;

-- ---- 9. equip_badge: проверяем и владение, и тип предмета.
CREATE OR REPLACE FUNCTION public.equip_badge(p_tg_id bigint, p_item_key text)
 RETURNS users
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user public.users;
begin
  if p_item_key is not null and not exists (
    select 1 from public.user_cosmetics uc
      join public.cosmetic_items ci on ci.key = uc.item_key
     where uc.tg_id = p_tg_id and uc.item_key = p_item_key and ci.type = 'badge'
  ) then
    raise exception 'NOT_OWNED';
  end if;

  update public.users
     set equipped_badge = p_item_key, updated_at = now()
   where tg_id = p_tg_id
  returning * into v_user;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  return v_user;
end $function$;

-- ---- 10. get_leaderboard: баланс монет чужих игроков не показываем
-- (как и в профиле, 071) — клиент его не использует.
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_tg_id bigint, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_top jsonb;
  v_me  jsonb;
begin
  select jsonb_agg(t) into v_top
    from (
      select
        row_number() over (order by weekly_score desc, tg_id asc) as rank,
        tg_id, username, first_name, photo_url, avatar_key, equipped_frame, equipped_badge,
        city, weekly_score, total_score
      from public.users
      order by weekly_score desc, tg_id asc
      limit p_limit
    ) t;

  select to_jsonb(r) into v_me
    from (
      select
        row_number() over (order by weekly_score desc, tg_id asc) as rank,
        tg_id, username, first_name, photo_url, avatar_key, equipped_frame, equipped_badge,
        city, weekly_score, total_score
      from public.users
    ) r
   where r.tg_id = p_tg_id;

  return jsonb_build_object(
    'top', coalesce(v_top, '[]'::jsonb),
    'me',  v_me
  );
end $function$;

-- ---- 11. credit_star_purchase: платёж от ещё не заходившего игрока.
CREATE OR REPLACE FUNCTION public.credit_star_purchase(p_tg_id bigint, p_telegram_charge_id text, p_pack_key text, p_stars_amount integer, p_coins_to_credit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user    public.users;
  v_inserted boolean;
begin
  -- Платёж мог прийти от того, кто ни разу не открывал мини-апп (ссылку
  -- на инвойс переслали): без строки в users FK ронял вставку, Stars
  -- списывались, а монеты терялись.
  insert into public.users (tg_id) values (p_tg_id) on conflict (tg_id) do nothing;

  insert into public.star_purchases
    (tg_id, telegram_charge_id, pack_key, stars_amount, coins_credited)
  values
    (p_tg_id, p_telegram_charge_id, p_pack_key, p_stars_amount, p_coins_to_credit)
  on conflict (telegram_charge_id) do nothing;

  v_inserted := found;

  if not v_inserted then
    -- этот платёж уже обработан раньше (повтор webhook) — не начисляем
    -- повторно, просто возвращаем текущий баланс.
    select * into v_user from public.users where tg_id = p_tg_id;
    return jsonb_build_object('user', to_jsonb(v_user), 'already_processed', true);
  end if;

  update public.users
     set coins = coins + p_coins_to_credit, updated_at = now()
   where tg_id = p_tg_id
  returning * into v_user;

  return jsonb_build_object('user', to_jsonb(v_user), 'already_processed', false);
end $function$;

-- ---- 12. Крон 068 удалял адресные дуэли, которые хост уже сыграл, —
-- они пропадали из истории и статистики. Сыгранные хостом закрываем
-- как 'declined' (цель так и не ответила), удаляем только пустые.
select cron.unschedule('expire-stale-duel-challenges')
 where exists (select 1 from cron.job where jobname = 'expire-stale-duel-challenges');
select cron.schedule(
  'expire-stale-duel-challenges',
  '0 3 * * *',
  $cron$
  update public.duels set status = 'declined'
   where status = 'invited' and created_at < now() - interval '7 days' and host_score is not null;
  delete from public.duels
   where status = 'invited' and created_at < now() - interval '7 days' and host_score is null;
  $cron$
);

-- ---- 13. events растёт бесконечно, а get_inactivity_reminders каждые 30
-- минут считает mode() по всей истории 'me'. Храним полгода.
select cron.unschedule('events-retention')
 where exists (select 1 from cron.job where jobname = 'events-retention');
select cron.schedule(
  'events-retention',
  '30 3 * * *',
  $cron$ delete from public.events where created_at < now() - interval '180 days'; $cron$
);

-- ---- 14. Курсы: несданный итоговый тест возвращал ВСЕ правильные ответы,
-- а пересдать можно было сразу — сертификат и +30 монет со второй
-- попытки без знаний. Теперь:
--   • одна попытка теста в день (course_enrollments.last_exam_on);
--   • варианты ответов перемешиваются на сервере заново для каждой
--     попытки (course_exam_order) — запомнить «третий вариант» нельзя;
--   • при провале — только какие вопросы неверны, без ответов/объяснений.
alter table public.course_enrollments add column if not exists last_exam_on date;

-- Порядок вариантов вопроса p_q для попытки p_attempt: массив исходных
-- индексов (0-based) в порядке показа. Детерминирован — start и complete
-- считают одно и то же, пока exam_attempts не увеличился.
create or replace function public.course_exam_order(
  p_tg_id bigint, p_course_key text, p_attempt integer, p_q integer, p_n integer
)
returns integer[]
language sql
immutable
set search_path = public
as $$
  select array_agg(i order by md5(p_tg_id::text || ':' || p_course_key || ':' || p_attempt || ':' || p_q || ':' || i))
    from generate_series(0, p_n - 1) as i;
$$;

revoke all on function public.course_exam_order(bigint, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.course_exam_order(bigint, text, integer, integer, integer) to service_role;

create or replace function public.get_courses(p_tg_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'key',             c.key,
           'category',        c.category,
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
                              and (e.last_exam_on is null or e.last_exam_on < current_date)
         ) order by c.ord), '[]'::jsonb)
    from public.courses c
    left join public.course_enrollments e on e.course_key = c.key and e.tg_id = p_tg_id
   where c.is_active;
$$;

revoke all on function public.get_courses(bigint) from public, anon, authenticated;
grant execute on function public.get_courses(bigint) to service_role;
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
    'ui',              v_course.ui,
    'total_days',      v_course.total_days,
    'pass_score',      v_course.pass_score,
    'exam_total',      jsonb_array_length(v_course.exam),
    'cards_total',     (select count(*) from public.course_cards cc where cc.course_key = v_course.key),
    'days_done',       coalesce(v_enr.days_done, 0),
    'started',         v_enr.tg_id is not null,
    'completed',       v_enr.completed_at is not null,
    'exam_attempts',   coalesce(v_enr.exam_attempts, 0),
    'available_today', v_enr.completed_at is null
                       and (v_enr.last_completed_on is null or v_enr.last_completed_on < current_date)
                       and (v_enr.last_exam_on is null or v_enr.last_exam_on < current_date),
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
  if v_enr.last_exam_on is not null and v_enr.last_exam_on >= current_date then
    raise exception 'COURSE_EXAM_LOCKED';
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
    'exam',          case when v_is_last then (
                       select jsonb_agg(jsonb_build_object(
                                'id',      q -> 'id',
                                'quote',   q ->> 'quote',
                                'options', (
                                  select jsonb_agg(q -> 'options' -> o order by k)
                                    from unnest(public.course_exam_order(
                                           p_tg_id, p_course_key, v_enr.exam_attempts, (qi - 1)::int,
                                           jsonb_array_length(q -> 'options'))) with ordinality as t(o, k)
                                )
                              ) order by qi)
                         from jsonb_array_elements(v_course.exam) with ordinality as e(q, qi)
                     ) else null end,
    'pass_score',    v_course.pass_score,
    'exam_attempts', v_enr.exam_attempts
  );
end $$;

revoke all on function public.start_course_day(bigint, text) from public, anon, authenticated;
grant execute on function public.start_course_day(bigint, text) to service_role;
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
  if v_enr.last_exam_on is not null and v_enr.last_exam_on >= current_date then
    raise exception 'COURSE_EXAM_LOCKED';
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

    -- Клиент присылает индекс варианта В ПОКАЗАННОМ порядке — переводим
    -- обратно в исходный тем же course_exam_order, что был в start_course_day.
    with graded as (
      select i,
             coalesce(
               (public.course_exam_order(
                  p_tg_id, p_course_key, v_enr.exam_attempts, (i - 1)::int,
                  jsonb_array_length(v_course.exam -> (i::int - 1) -> 'options')
                ))[p_exam_answers[i::int] + 1] = (k ->> 'answer')::int,
               false) as ok
        from jsonb_array_elements(v_course.exam_key) with ordinality as t(k, i)
    )
    select count(*) filter (where ok),
           jsonb_agg(jsonb_build_object('correct', ok) order by i)
      into v_score, v_results
      from graded;

    update public.course_enrollments
       set exam_attempts = exam_attempts + 1,
           exam_best     = greatest(coalesce(exam_best, 0), v_score),
           last_exam_on  = current_date
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
       and (e.last_exam_on is null or e.last_exam_on < current_date)
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
