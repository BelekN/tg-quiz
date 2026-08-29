-- ============================================================
-- Баг: "первому участнику не приходят результаты, видит только
-- второй" — хост, ответив на все вопросы, уходит на экран ожидания
-- и делится инвайтом; пока гость проходит тест, хост почти всегда
-- сворачивает/закрывает мини-апп (чтобы отправить ссылку) — Telegram
-- останавливает JS, поллинг замирает. В отличие от дуэли, у теста на
-- совместимость не было НИ пуша по завершению, НИ записи в истории —
-- результат для хоста был потерян безвозвратно, если он не успел
-- зафиксировать поллингом момент завершения гостем.
--
-- Фикс:
-- 1. answer_compat теперь возвращает notify (tg_id второго участника +
--    % совпадения) в момент, когда сессия ИМЕННО СЕЙЧАС завершилась —
--    tg-api шлёт пуш с deep-link'ом обратно в эту сессию (как у
--    finish_duel/rematch_duel).
-- 2. start_compat при резюме отдаёт session_completed/match_percent —
--    открыв мини-апп по этому пушу, хост сразу видит результат, а не
--    заново проходит вопросы.
-- 3. get_history — добавлена ветка compat, как страховка на случай
--    отключённых уведомлений/пропущенного пуша.
-- ============================================================

create or replace function public.start_compat(
  p_tg_id      bigint,
  p_test_key   text default null,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.compat_sessions;
  v_test    public.compat_tests;
  v_role    text;
  v_ids     uuid[];
  v_questions jsonb;
begin
  if p_session_id is null then
    if p_test_key is null then
      raise exception 'TEST_KEY_REQUIRED';
    end if;

    select * into v_test from public.compat_tests where key = p_test_key and is_active;
    if not found then
      raise exception 'TEST_NOT_FOUND';
    end if;

    select array_agg(id order by ord) into v_ids
      from public.compat_questions where test_key = p_test_key;

    insert into public.compat_sessions (test_key, host_tg_id, question_ids)
    values (p_test_key, p_tg_id, v_ids)
    returning * into v_session;

    v_role := 'host';
  else
    select * into v_session from public.compat_sessions where id = p_session_id for update;
    if not found then
      raise exception 'SESSION_NOT_FOUND';
    end if;

    if v_session.host_tg_id = p_tg_id then
      v_role := 'host';
    else
      if v_session.guest_tg_id is not null and v_session.guest_tg_id <> p_tg_id then
        raise exception 'SESSION_ALREADY_TAKEN';
      end if;
      if v_session.guest_tg_id is null then
        update public.compat_sessions set guest_tg_id = p_tg_id
         where id = v_session.id
        returning * into v_session;
      end if;
      v_role := 'guest';
    end if;

    select * into v_test from public.compat_tests where key = v_session.test_key;
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'id',       cq.id,
             'question', cq.question,
             'options',  (
               select jsonb_agg(o.label order by random_ord)
                 from (
                   select label, md5(v_session.id::text || ':' || cq.id::text || ':' || ord) as random_ord
                     from public.compat_options where question_id = cq.id
                 ) o
             )
           ) order by cq.ord
         )
    into v_questions
    from public.compat_questions cq
   where cq.id = any(v_session.question_ids);

  return jsonb_build_object(
    'session_id',        v_session.id,
    'role',               v_role,
    'test_key',           v_test.key,
    'title',              v_test.title,
    'description',        v_test.description,
    'icon',               v_test.icon,
    'questions',          v_questions,
    -- Резюме уже завершённой сессии (например, хост открыл мини-апп по
    -- пушу о готовом результате) — клиент должен уйти сразу на экран
    -- результата, а не заново гонять вопросы.
    'session_completed',  v_session.status = 'completed',
    'match_percent',      v_session.match_percent
  );
end $$;

create or replace function public.answer_compat(
  p_tg_id        bigint,
  p_session_id   uuid,
  p_question_id  uuid,
  p_option_index smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
end $$;

revoke all on function public.start_compat(bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.start_compat(bigint, text, uuid) to service_role;
revoke all on function public.answer_compat(bigint, uuid, uuid, smallint) from public, anon, authenticated;
grant execute on function public.answer_compat(bigint, uuid, uuid, smallint) to service_role;

-- ------------------------------------------------------------
-- get_history — та же функция, что в 034_marathon.sql, плюс 7-я
-- ветка union all для теста на совместимость.
-- ------------------------------------------------------------
create or replace function public.get_history(
  p_tg_id bigint,
  p_limit integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  with combined as (
    select
      coalesce(d.completed_at, d.created_at) as happened_at,
      jsonb_build_object(
        'kind',            'duel',
        'id',              d.id,
        'happened_at',     coalesce(d.completed_at, d.created_at),
        'my_score',        ms.my_score,
        'opponent_score',  ms.opp_score,
        'opponent',        case when u.tg_id is not null then jsonb_build_object(
                              'first_name', u.first_name,
                              'username',   u.username,
                              'photo_url',  u.photo_url,
                              'avatar_key', u.avatar_key
                            ) else null end,
        'outcome',         case
                              when ms.opp_score is null then 'pending'
                              when ms.my_score > ms.opp_score then 'win'
                              when ms.my_score < ms.opp_score then 'lose'
                              else 'draw'
                            end
      ) as item
    from public.duels d
    cross join lateral (
      select
        case when d.host_tg_id = p_tg_id then d.host_score  else d.guest_score end as my_score,
        case when d.host_tg_id = p_tg_id then d.guest_score else d.host_score  end as opp_score,
        case when d.host_tg_id = p_tg_id then d.guest_tg_id else d.host_tg_id  end as opp_tg_id
    ) ms
    left join public.users u on u.tg_id = ms.opp_tg_id
    where (d.host_tg_id = p_tg_id and d.host_score is not null)
       or (d.guest_tg_id = p_tg_id and d.guest_score is not null)

    union all

    select
      coalesce(s.completed_at, s.created_at),
      jsonb_build_object(
        'kind',        'solo',
        'id',          s.id,
        'happened_at', coalesce(s.completed_at, s.created_at),
        'category',    s.category,
        'score',       s.score,
        'correct',     (
                         select count(*) from public.solo_answers sa
                          where sa.session_id = s.id and sa.is_correct
                        ),
        'total',       array_length(s.question_ids, 1)
      )
    from public.solo_sessions s
    where s.tg_id = p_tg_id and s.status = 'completed'

    union all

    select
      coalesce(sp.completed_at, sp.started_at),
      jsonb_build_object(
        'kind',        'sprint',
        'id',          sp.id,
        'happened_at', coalesce(sp.completed_at, sp.started_at),
        'score',       sp.score,
        'correct',     (
                         select count(*) from public.sprint_answers pa
                          where pa.session_id = sp.id and pa.is_correct
                        )
      )
    from public.sprint_sessions sp
    where sp.tg_id = p_tg_id and sp.status = 'completed'

    union all

    select
      ps.completed_at,
      jsonb_build_object(
        'kind',        'persona',
        'id',          ps.id,
        'happened_at', ps.completed_at,
        'test_key',    ps.test_key,
        'test_title',  pt.title,
        'result_key',  ps.result_key,
        'result_title', pr.title,
        'icon',        pr.icon
      )
    from public.persona_sessions ps
    join public.persona_tests pt on pt.key = ps.test_key
    join public.persona_results pr on pr.test_key = ps.test_key and pr.key = ps.result_key
    where ps.tg_id = p_tg_id and ps.completed_at is not null

    union all

    select
      d.completed_at,
      jsonb_build_object(
        'kind',        'daily',
        'id',          d.id,
        'happened_at', d.completed_at,
        'score',       d.score,
        'correct',     (
                         select count(*) from public.daily_answers da
                          where da.session_id = d.id and da.is_correct
                        ),
        'total',       array_length(d.question_ids, 1)
      )
    from public.daily_sessions d
    where d.tg_id = p_tg_id and d.status = 'completed'

    union all

    select
      m.completed_at,
      jsonb_build_object(
        'kind',        'marathon',
        'id',          m.id,
        'happened_at', m.completed_at,
        'score',       m.score,
        'correct',     (
                         select count(*) from public.marathon_answers ma
                          where ma.session_id = m.id and ma.is_correct
                        )
      )
    from public.marathon_sessions m
    where m.tg_id = p_tg_id and m.status = 'completed'

    union all

    select
      cs.completed_at,
      jsonb_build_object(
        'kind',           'compat',
        'id',             cs.id,
        'happened_at',    cs.completed_at,
        'test_key',       cs.test_key,
        'test_title',     ct.title,
        'icon',           ct.icon,
        'match_percent',  cs.match_percent,
        'partner',        case when pu.tg_id is not null then jsonb_build_object(
                             'first_name', pu.first_name,
                             'username',   pu.username,
                             'photo_url',  pu.photo_url,
                             'avatar_key', pu.avatar_key
                           ) else null end
      )
    from public.compat_sessions cs
    join public.compat_tests ct on ct.key = cs.test_key
    left join public.users pu
      on pu.tg_id = (case when cs.host_tg_id = p_tg_id then cs.guest_tg_id else cs.host_tg_id end)
    where (cs.host_tg_id = p_tg_id or cs.guest_tg_id = p_tg_id) and cs.status = 'completed'
  ),
  limited as (
    select happened_at, item from combined order by happened_at desc limit p_limit
  )
  select coalesce(jsonb_agg(item order by happened_at desc), '[]'::jsonb)
    into v_result
    from limited;

  return v_result;
end $$;

revoke all on function public.get_history(bigint, integer) from public, anon, authenticated;
grant execute on function public.get_history(bigint, integer) to service_role;
