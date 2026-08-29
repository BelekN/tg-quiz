-- ============================================================
-- "История игр" должна открывать полный результат по тапу — тот же
-- текст/цифры, что на финальном экране игры/теста. get_history раньше
-- отдавал только сводку для строки списка; добавляем недостающие
-- поля: my_correct/total для дуэли, coins_earned для соло/спринта/
-- ежедневного/марафона, description для "Узнай себя" (тот самый
-- текст результата теста).
-- ============================================================

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
        'my_correct',      (
                             select count(*) filter (where is_correct)
                               from public.duel_answers
                              where duel_id = d.id and tg_id = p_tg_id
                           ),
        'total',           5,
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
        'coins_earned', s.coins_earned,
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
        'coins_earned', sp.coins_earned,
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
        'description', pr.description,
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
        'coins_earned', d.coins_earned,
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
        'coins_earned', m.coins_earned,
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
