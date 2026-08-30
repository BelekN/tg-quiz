-- ============================================================
-- RPC для адресных вызовов на дуэль (см. план piped-wobbling-quokka):
-- вызов конкретного игрока (по tg_id из рейтинга или через find_user),
-- входящие вызовы с принять/отклонить, статистика по соперникам.
-- ============================================================

-- start_duel: добавлен необязательный p_target_tg_id. Когда задан при
-- создании новой дуэли (p_duel_id is null) — вместо обычного открытого
-- duel (status='pending', кто первый откроет ссылку — тот и гость)
-- создаёт адресный: invited_tg_id = цель, status='invited', guest_tg_id
-- пока пуст. Остальная логика (подбор вопросов, ветка присоединения по
-- duel_id) не меняется вообще.
--
-- ВАЖНО: CREATE OR REPLACE не может добавить параметр к существующей
-- функции — старая сигнатура (bigint, uuid, integer) осталась бы
-- отдельным перегруженным вариантом, и вызов с 3 именованными
-- аргументами стал бы неоднозначным (подходят оба). Дропаем старую
-- сигнатуру явно перед созданием новой.
drop function if exists public.start_duel(bigint, uuid, integer);

create or replace function public.start_duel(
  p_tg_id bigint,
  p_duel_id uuid default null,
  p_questions_count integer default 5,
  p_target_tg_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
end $$;

-- Входящие вызовы: кто вызвал именно меня и ещё ждёт ответа.
create or replace function public.get_duel_challenges(p_tg_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'duel_id',    d.id,
           'created_at', d.created_at,
           'host', jsonb_build_object(
             'tg_id',           u.tg_id,
             'username',        u.username,
             'first_name',      u.first_name,
             'photo_url',       u.photo_url,
             'avatar_key',      u.avatar_key,
             'equipped_frame',  u.equipped_frame
           )
         ) order by d.created_at desc), '[]'::jsonb)
    into v_result
    from public.duels d
    join public.users u on u.tg_id = d.host_tg_id
   where d.invited_tg_id = p_tg_id and d.status = 'invited';

  return v_result;
end $$;

-- Принять вызов: делает получателя гостем и переоткрывает дуэль для
-- игры — вопросы дальше отдаёт уже существующий start_duel(duel_id).
create or replace function public.accept_duel_challenge(p_tg_id bigint, p_duel_id uuid)
returns public.duels
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel public.duels;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then raise exception 'DUEL_NOT_FOUND'; end if;
  if v_duel.invited_tg_id is distinct from p_tg_id or v_duel.status <> 'invited' then
    raise exception 'NOT_INVITED';
  end if;

  update public.duels
     set guest_tg_id = p_tg_id, status = 'pending'
   where id = p_duel_id
  returning * into v_duel;

  return v_duel;
end $$;

-- Отклонить вызов: тихо, без пуша хосту (см. план — осознанно, не
-- плодим негативные уведомления).
create or replace function public.decline_duel_challenge(p_tg_id bigint, p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel public.duels;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then raise exception 'DUEL_NOT_FOUND'; end if;
  if v_duel.invited_tg_id is distinct from p_tg_id or v_duel.status <> 'invited' then
    raise exception 'NOT_INVITED';
  end if;

  update public.duels set status = 'declined' where id = p_duel_id;
end $$;

-- Найти игрока по нику (с "@" или без, регистронезависимо) или по
-- числовому tg_id — только среди тех, кто хоть раз открывал бота.
create or replace function public.find_user(p_query text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := trim(p_query);
  v_user  public.users;
  v_found boolean := false;
begin
  if v_query is null or v_query = '' then
    return null;
  end if;

  if v_query ~ '^[0-9]+$' then
    begin
      select * into v_user from public.users where tg_id = v_query::bigint;
      v_found := found;
    exception when others then
      v_found := false;
    end;
  else
    select * into v_user from public.users
     where lower(username) = lower(ltrim(v_query, '@'));
    v_found := found;
  end if;

  if not v_found then
    return null;
  end if;

  return jsonb_build_object(
    'tg_id',          v_user.tg_id,
    'username',       v_user.username,
    'first_name',     v_user.first_name,
    'photo_url',      v_user.photo_url,
    'avatar_key',     v_user.avatar_key,
    'equipped_frame', v_user.equipped_frame
  );
end $$;

-- Статистика по соперникам: с кем чаще всего играешь и счёт побед,
-- по уже завершённым дуэлям (открытым или адресным — не важно).
create or replace function public.get_rivals(p_tg_id bigint, p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'tg_id',          u.tg_id,
           'username',       u.username,
           'first_name',     u.first_name,
           'photo_url',      u.photo_url,
           'avatar_key',     u.avatar_key,
           'equipped_frame', u.equipped_frame,
           'games',          r.games,
           'wins',           r.wins,
           'losses',         r.losses,
           'draws',          r.draws
         ) order by r.games desc), '[]'::jsonb)
    into v_result
    from (
      select
        case when host_tg_id = p_tg_id then guest_tg_id else host_tg_id end as opponent_tg_id,
        count(*) as games,
        count(*) filter (
          where (host_tg_id = p_tg_id and host_score > guest_score)
             or (guest_tg_id = p_tg_id and guest_score > host_score)
        ) as wins,
        count(*) filter (
          where (host_tg_id = p_tg_id and host_score < guest_score)
             or (guest_tg_id = p_tg_id and guest_score < host_score)
        ) as losses,
        count(*) filter (where host_score = guest_score) as draws
      from public.duels
      where status = 'completed'
        and guest_tg_id is not null
        and (host_tg_id = p_tg_id or guest_tg_id = p_tg_id)
      group by opponent_tg_id
      order by count(*) desc
      limit p_limit
    ) r
    join public.users u on u.tg_id = r.opponent_tg_id;

  return v_result;
end $$;

revoke all on function public.start_duel(bigint, uuid, integer, bigint) from public, anon, authenticated;
grant execute on function public.start_duel(bigint, uuid, integer, bigint) to service_role;

revoke all on function public.get_duel_challenges(bigint) from public, anon, authenticated;
grant execute on function public.get_duel_challenges(bigint) to service_role;

revoke all on function public.accept_duel_challenge(bigint, uuid) from public, anon, authenticated;
grant execute on function public.accept_duel_challenge(bigint, uuid) to service_role;

revoke all on function public.decline_duel_challenge(bigint, uuid) from public, anon, authenticated;
grant execute on function public.decline_duel_challenge(bigint, uuid) to service_role;

revoke all on function public.find_user(text) from public, anon, authenticated;
grant execute on function public.find_user(text) to service_role;

revoke all on function public.get_rivals(bigint, integer) from public, anon, authenticated;
grant execute on function public.get_rivals(bigint, integer) to service_role;
