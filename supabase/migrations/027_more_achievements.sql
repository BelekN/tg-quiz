-- ============================================================
-- 5 новых достижений: "Кто ты из...", реванши, все режимы, реальный
-- соперник, полуночник.
-- ============================================================

-- is_rematch нужен, чтобы отличить дуэль, созданную через "Реванш",
-- от обычной — сейчас rematch_duel вставляет строку точно так же, как
-- start_duel(null), и никак не помечена как реванш.
alter table public.duels add column if not exists is_rematch boolean not null default false;

create or replace function public.rematch_duel(
  p_tg_id           bigint,
  p_duel_id         uuid,
  p_questions_count integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old       public.duels;
  v_rival_id  bigint;
  v_ids       uuid[];
  v_new       public.duels;
  v_questions jsonb;
begin
  select * into v_old from public.duels where id = p_duel_id;
  if not found then
    raise exception 'DUEL_NOT_FOUND';
  end if;

  if p_tg_id <> v_old.host_tg_id and p_tg_id <> coalesce(v_old.guest_tg_id, -1) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  if v_old.host_score is null or v_old.guest_score is null then
    raise exception 'DUEL_NOT_FINISHED';
  end if;

  v_rival_id := case
    when p_tg_id = v_old.host_tg_id then v_old.guest_tg_id
    else v_old.host_tg_id
  end;

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

  insert into public.duels (host_tg_id, question_ids, is_rematch)
  values (p_tg_id, v_ids, true)
  returning * into v_new;

  select jsonb_agg(
           jsonb_build_object(
             'id',       q.id,
             'question', q.question,
             'options',  public.shuffle_options(q.options, v_new.id::text || ':' || q.id::text),
             'category', q.category
           ) order by t.ord
         )
    into v_questions
    from unnest(v_new.question_ids) with ordinality as t(qid, ord)
    join public.questions q on q.id = t.qid;

  return jsonb_build_object(
    'duel_id',     v_new.id,
    'role',        'host',
    'status',      v_new.status,
    'questions',   v_questions,
    'answered',    0,
    'correct',     0,
    'rival_tg_id', v_rival_id
  );
end $$;

-- ------------------------------------------------------------
-- Каталог: 5 новых достижений
-- ------------------------------------------------------------
insert into public.achievements (key, title, description, icon) values
  ('all_personas', 'Исследователь личности', 'Пройди все тесты «Кто ты из...»',                       '🔮'),
  ('rematch_5',    'Заядлый реваншист',       'Сыграй 5 реваншей',                                      '🔁'),
  ('all_modes',    'Универсал',               'Сыграй в дуэль, квиз-тест и спринт хотя бы раз',         '🎯'),
  ('real_duel',    'Настоящий соперник',      'Заверши дуэль, в которой реально участвовали два игрока', '🤝'),
  ('night_owl',    'Полуночник',              'Сыграй что-нибудь между полуночью и 5 утра',             '🦉')
on conflict (key) do update set
  title       = excluded.title,
  description = excluded.description,
  icon        = excluded.icon;

-- ------------------------------------------------------------
-- check_achievements — та же логика, что в 020_fixes.sql, плюс 5
-- новых проверок.
-- ------------------------------------------------------------
create or replace function public.check_achievements(p_tg_id bigint)
returns jsonb
language plpgsql
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
  v_ace             boolean;
  v_all_personas    integer;
  v_persona_done    integer;
  v_rematch_count   integer;
  v_has_solo        boolean;
  v_has_sprint      boolean;
  v_real_duel       boolean;
  v_night_owl       boolean;
  v_keys            text[] := '{}';
  v_newly           jsonb;
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

  -- Кто ты из...: сколько тестов есть сейчас vs сколько этот игрок
  -- прошёл до конца (динамически, не зашитым числом — та же логика,
  -- что уже была исправлена для all_categories).
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

  -- Час — по UTC (session timezone функции), не по локальному времени
  -- игрока: у нас нигде не хранится таймзона пользователя. Для шутливого
  -- достижения это приемлемое приближение, не точный расчёт.
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

  if v_duel_count >= 1                                         then v_keys := array_append(v_keys, 'first_duel');     end if;
  if v_win_count >= 10                                         then v_keys := array_append(v_keys, 'duel_wins_10');   end if;
  if v_streak >= 3                                             then v_keys := array_append(v_keys, 'win_streak_3');   end if;
  if v_perfect                                                  then v_keys := array_append(v_keys, 'perfect_solo');   end if;
  if v_ace                                                      then v_keys := array_append(v_keys, 'sprint_ace');     end if;
  if v_all_categories > 0 and v_categories >= v_all_categories then
    v_keys := array_append(v_keys, 'all_categories');
  end if;
  if coalesce(v_total_score, 0) >= 5000                         then v_keys := array_append(v_keys, 'score_5000');     end if;
  if v_all_personas > 0 and v_persona_done >= v_all_personas   then
    v_keys := array_append(v_keys, 'all_personas');
  end if;
  if v_rematch_count >= 5                                       then v_keys := array_append(v_keys, 'rematch_5');     end if;
  if v_duel_count >= 1 and v_has_solo and v_has_sprint          then v_keys := array_append(v_keys, 'all_modes');     end if;
  if v_real_duel                                                then v_keys := array_append(v_keys, 'real_duel');     end if;
  if v_night_owl                                                then v_keys := array_append(v_keys, 'night_owl');     end if;

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
