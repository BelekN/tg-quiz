-- ============================================================
-- Три новых достижения вокруг вызовов на дуэль: сам факт вызова кого-то
-- напрямую, разнообразие соперников, и "личный счёт" — победная серия
-- именно против одного и того же человека (а не общая серия побед,
-- которую уже считает win_streak_3).
-- ============================================================

create or replace function public.get_user_stats(p_tg_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_duel_count      integer;
  v_win_count       integer := 0;
  v_streak          integer := 0;
  v_total_score     integer;
  v_categories      integer;
  v_all_categories  integer;
  v_perfect         boolean;
  v_sprint_best     integer;
  v_all_personas    integer;
  v_persona_done    integer;
  v_rematch_count   integer;
  v_has_solo        boolean;
  v_has_sprint      boolean;
  v_real_duel       boolean;
  v_night_owl       boolean;
  v_daily_streak    integer;
  v_perfect_duel    boolean;
  v_category_master boolean;
  v_challenges_sent      integer := 0;
  v_distinct_opponents   integer := 0;
  v_max_opponent_streak  integer := 0;
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

  select total_score, coalesce(current_streak, 0)
    into v_total_score, v_daily_streak
    from public.users where tg_id = p_tg_id;

  select count(distinct category) into v_categories
    from public.solo_sessions
   where tg_id = p_tg_id and status = 'completed' and category <> 'mixed';

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

  select coalesce(max(cnt), 0) into v_sprint_best
    from (
      select (select count(*) from public.sprint_answers pa
               where pa.session_id = sp.id and pa.is_correct) as cnt
        from public.sprint_sessions sp
       where sp.tg_id = p_tg_id and sp.status = 'completed'
    ) t;

  select count(distinct key) into v_all_personas
    from public.persona_tests where is_active;
  select count(distinct test_key) into v_persona_done
    from public.persona_sessions
   where tg_id = p_tg_id and completed_at is not null;

  select count(*) into v_rematch_count
    from public.duels
   where host_tg_id = p_tg_id and is_rematch and host_score is not null;

  select exists(select 1 from public.solo_sessions where tg_id = p_tg_id and status = 'completed')
    into v_has_solo;
  select exists(select 1 from public.sprint_sessions where tg_id = p_tg_id and status = 'completed')
    into v_has_sprint;

  select exists(
    select 1 from public.duels
     where (host_tg_id = p_tg_id or guest_tg_id = p_tg_id)
       and host_score is not null and guest_score is not null
  ) into v_real_duel;

  select exists(
    select 1 from public.duel_answers
     where tg_id = p_tg_id and extract(hour from created_at) between 0 and 4
    union all
    select 1 from public.solo_answers sa
      join public.solo_sessions s on s.id = sa.session_id
     where s.tg_id = p_tg_id and extract(hour from sa.created_at) between 0 and 4
    union all
    select 1 from public.sprint_answers pa
      join public.sprint_sessions sp on sp.id = pa.session_id
     where sp.tg_id = p_tg_id and extract(hour from pa.created_at) between 0 and 4
  ) into v_night_owl;

  -- Победа в дуэли, где ВСЕ свои ответы правильные (не просто участие).
  select exists(
    select 1 from public.duels d
     where (d.host_tg_id = p_tg_id or d.guest_tg_id = p_tg_id)
       and d.host_score is not null and d.guest_score is not null
       and (case when d.host_tg_id = p_tg_id then d.host_score else d.guest_score end)
         > (case when d.host_tg_id = p_tg_id then d.guest_score else d.host_score end)
       and (
         select count(*) filter (where is_correct) = count(*)
           from public.duel_answers da
          where da.duel_id = d.id and da.tg_id = p_tg_id
       )
  ) into v_perfect_duel;

  -- Хотя бы одна категория тестов "Кто ты из...", пройденная целиком.
  select exists(
    select 1
      from (
        select category, count(*) as total
          from public.persona_tests where is_active
         group by category
      ) cat_totals
     where cat_totals.total <= (
       select count(distinct ps.test_key)
         from public.persona_sessions ps
         join public.persona_tests pt on pt.key = ps.test_key
        where ps.tg_id = p_tg_id and ps.completed_at is not null
          and pt.category = cat_totals.category
     )
  ) into v_category_master;

  -- Сколько раз я сам вызвал кого-то напрямую (адресный вызов, не
  -- важно, ответили или нет).
  select count(*) into v_challenges_sent
    from public.duels
   where host_tg_id = p_tg_id and invited_tg_id is not null;

  -- С кем и как часто сыграно (только завершённые дуэли) — нужно и для
  -- "разных соперников", и для "серии побед против ОДНОГО и того же".
  select count(distinct opponent_tg_id) into v_distinct_opponents
    from (
      select case when host_tg_id = p_tg_id then guest_tg_id else host_tg_id end as opponent_tg_id
        from public.duels
       where status = 'completed' and guest_tg_id is not null
         and (host_tg_id = p_tg_id or guest_tg_id = p_tg_id)
    ) opp;

  with my_opp_duels as (
    select
      case when host_tg_id = p_tg_id then guest_tg_id else host_tg_id end as opponent_tg_id,
      coalesce(completed_at, created_at) as happened_at,
      (case when host_tg_id = p_tg_id then host_score  else guest_score end)
        > (case when host_tg_id = p_tg_id then guest_score else host_score end) as is_win
    from public.duels
    where status = 'completed' and guest_tg_id is not null
      and (host_tg_id = p_tg_id or guest_tg_id = p_tg_id)
  ),
  opp_flagged as (
    select *,
      sum(case when is_win then 0 else 1 end)
        over (partition by opponent_tg_id order by happened_at desc) as loss_group
    from my_opp_duels
  )
  select coalesce(max(cnt), 0) into v_max_opponent_streak
    from (
      select count(*) filter (where is_win and loss_group = 0) as cnt
        from opp_flagged
       group by opponent_tg_id
    ) per_opponent;

  return jsonb_build_object(
    'duel_count',          v_duel_count,
    'win_count',           v_win_count,
    'streak',              v_streak,
    'total_score',         coalesce(v_total_score, 0),
    'categories_done',     v_categories,
    'all_categories',      v_all_categories,
    'perfect_solo',        v_perfect,
    'sprint_best_correct', v_sprint_best,
    'all_personas',        v_all_personas,
    'persona_done',        v_persona_done,
    'rematch_count',       v_rematch_count,
    'has_solo',            v_has_solo,
    'has_sprint',          v_has_sprint,
    'real_duel',           v_real_duel,
    'night_owl',           v_night_owl,
    'daily_streak',        coalesce(v_daily_streak, 0),
    'perfect_duel',        v_perfect_duel,
    'category_master',     v_category_master,
    'challenges_sent',     v_challenges_sent,
    'distinct_opponents',  v_distinct_opponents,
    'max_opponent_streak', v_max_opponent_streak
  );
end $$;

create or replace function public.check_achievements(p_tg_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stats jsonb;
  v_keys  text[] := '{}';
  v_newly jsonb;
begin
  v_stats := public.get_user_stats(p_tg_id);

  if (v_stats->>'duel_count')::int >= 1                                              then v_keys := array_append(v_keys, 'first_duel');     end if;
  if (v_stats->>'win_count')::int >= 10                                              then v_keys := array_append(v_keys, 'duel_wins_10');   end if;
  if (v_stats->>'streak')::int >= 3                                                  then v_keys := array_append(v_keys, 'win_streak_3');   end if;
  if (v_stats->>'perfect_solo')::boolean                                             then v_keys := array_append(v_keys, 'perfect_solo');   end if;
  if (v_stats->>'sprint_best_correct')::int >= 20                                    then v_keys := array_append(v_keys, 'sprint_ace');     end if;
  if (v_stats->>'all_categories')::int > 0
     and (v_stats->>'categories_done')::int >= (v_stats->>'all_categories')::int     then v_keys := array_append(v_keys, 'all_categories'); end if;
  if (v_stats->>'total_score')::int >= 5000                                          then v_keys := array_append(v_keys, 'score_5000');     end if;
  if (v_stats->>'all_personas')::int > 0
     and (v_stats->>'persona_done')::int >= (v_stats->>'all_personas')::int          then v_keys := array_append(v_keys, 'all_personas');   end if;
  if (v_stats->>'rematch_count')::int >= 5                                           then v_keys := array_append(v_keys, 'rematch_5');      end if;
  if (v_stats->>'duel_count')::int >= 1
     and (v_stats->>'has_solo')::boolean
     and (v_stats->>'has_sprint')::boolean                                           then v_keys := array_append(v_keys, 'all_modes');      end if;
  if (v_stats->>'real_duel')::boolean                                                then v_keys := array_append(v_keys, 'real_duel');      end if;
  if (v_stats->>'night_owl')::boolean                                                then v_keys := array_append(v_keys, 'night_owl');      end if;
  if (v_stats->>'daily_streak')::int >= 7                                            then v_keys := array_append(v_keys, 'streak_7');       end if;
  if (v_stats->>'daily_streak')::int >= 30                                           then v_keys := array_append(v_keys, 'streak_30');      end if;
  if (v_stats->>'perfect_duel')::boolean                                             then v_keys := array_append(v_keys, 'perfect_duel');   end if;
  if (v_stats->>'persona_done')::int >= 1                                            then v_keys := array_append(v_keys, 'first_persona');  end if;
  if (v_stats->>'category_master')::boolean                                          then v_keys := array_append(v_keys, 'category_master'); end if;
  if (v_stats->>'daily_streak')::int >= 14                                           then v_keys := array_append(v_keys, 'streak_14');      end if;
  if (v_stats->>'challenges_sent')::int >= 1                                         then v_keys := array_append(v_keys, 'first_challenge'); end if;
  if (v_stats->>'distinct_opponents')::int >= 5                                      then v_keys := array_append(v_keys, 'social_butterfly'); end if;
  if (v_stats->>'max_opponent_streak')::int >= 3                                     then v_keys := array_append(v_keys, 'nemesis');        end if;

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

create or replace function public.get_achievements(p_tg_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stats  jsonb;
  v_result jsonb;
begin
  v_stats := public.get_user_stats(p_tg_id);

  select coalesce(jsonb_agg(jsonb_build_object(
           'key',         a.key,
           'title',       a.title,
           'description', a.description,
           'icon',        a.icon,
           'category',    a.category,
           'unlocked_at', ua.unlocked_at,
           'progress',    case a.key
             when 'duel_wins_10' then jsonb_build_object(
               'current', least((v_stats->>'win_count')::int, 10), 'target', 10)
             when 'win_streak_3' then jsonb_build_object(
               'current', least((v_stats->>'streak')::int, 3), 'target', 3)
             when 'sprint_ace' then jsonb_build_object(
               'current', least((v_stats->>'sprint_best_correct')::int, 20), 'target', 20)
             when 'all_categories' then jsonb_build_object(
               'current', least((v_stats->>'categories_done')::int, (v_stats->>'all_categories')::int),
               'target', (v_stats->>'all_categories')::int)
             when 'score_5000' then jsonb_build_object(
               'current', least((v_stats->>'total_score')::int, 5000), 'target', 5000)
             when 'all_personas' then jsonb_build_object(
               'current', least((v_stats->>'persona_done')::int, (v_stats->>'all_personas')::int),
               'target', (v_stats->>'all_personas')::int)
             when 'rematch_5' then jsonb_build_object(
               'current', least((v_stats->>'rematch_count')::int, 5), 'target', 5)
             when 'all_modes' then jsonb_build_object(
               'current',
                 (case when (v_stats->>'duel_count')::int >= 1 then 1 else 0 end)
               + (case when (v_stats->>'has_solo')::boolean then 1 else 0 end)
               + (case when (v_stats->>'has_sprint')::boolean then 1 else 0 end),
               'target', 3)
             when 'streak_7' then jsonb_build_object(
               'current', least((v_stats->>'daily_streak')::int, 7), 'target', 7)
             when 'streak_14' then jsonb_build_object(
               'current', least((v_stats->>'daily_streak')::int, 14), 'target', 14)
             when 'streak_30' then jsonb_build_object(
               'current', least((v_stats->>'daily_streak')::int, 30), 'target', 30)
             when 'social_butterfly' then jsonb_build_object(
               'current', least((v_stats->>'distinct_opponents')::int, 5), 'target', 5)
             when 'nemesis' then jsonb_build_object(
               'current', least((v_stats->>'max_opponent_streak')::int, 3), 'target', 3)
             else null
           end
         ) order by a.ord, a.key), '[]'::jsonb)
    into v_result
    from public.achievements a
    left join public.user_achievements ua on ua.achievement_key = a.key and ua.tg_id = p_tg_id;

  return v_result;
end $$;

insert into public.achievements (key, title, description, icon, category, ord) values
  ('first_challenge',   'Бросил вызов',        'Вызови другого игрока напрямую — из рейтинга или списка соперников', '📨', 'Дуэли', 19),
  ('social_butterfly',  'Душа компании',       'Сыграй завершённые дуэли с 5 разными соперниками',                    '🎉', 'Дуэли', 20),
  ('nemesis',           'Личный счёт',         'Выиграй 3 дуэли подряд у одного и того же соперника',                 '🥊', 'Дуэли', 21)
on conflict (key) do update set
  title = excluded.title, description = excluded.description, icon = excluded.icon,
  category = excluded.category, ord = excluded.ord;

revoke all on function public.get_user_stats(bigint) from public, anon, authenticated;
grant execute on function public.get_user_stats(bigint) to service_role;
revoke all on function public.check_achievements(bigint) from public, anon, authenticated;
grant execute on function public.check_achievements(bigint) to service_role;
revoke all on function public.get_achievements(bigint) from public, anon, authenticated;
grant execute on function public.get_achievements(bigint) to service_role;
