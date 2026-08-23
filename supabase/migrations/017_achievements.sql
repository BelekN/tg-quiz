-- ------------------------------------------------------------
-- Достижения: статичный каталог + то, что разблокировал пользователь
-- ------------------------------------------------------------
create table if not exists public.achievements (
  key         text primary key,
  title       text not null,
  description text not null,
  icon        text not null
);

insert into public.achievements (key, title, description, icon) values
  ('first_duel',     'Первая дуэль',  'Сыграйте свою первую дуэль',            '⚔️'),
  ('duel_wins_10',   'Ветеран',       'Одержите 10 побед в дуэлях',            '🎖️'),
  ('win_streak_3',   'Не остановить','3 победы в дуэлях подряд',              '🔥'),
  ('perfect_solo',   'Идеально',      '100% правильных ответов в квиз-тесте', '💯'),
  ('sprint_ace',     'Скорострел',    '20+ правильных ответов в Спринте',     '⚡'),
  ('all_categories', 'Эрудит',        'Сыграйте квиз-тест во всех категориях','🧠'),
  ('score_5000',     'Профи',         'Наберите 5000 очков всего',            '🏆')
on conflict (key) do nothing;

create table if not exists public.user_achievements (
  tg_id           bigint      not null references public.users (tg_id) on delete cascade,
  achievement_key text        not null references public.achievements (key),
  unlocked_at     timestamptz not null default now(),
  primary key (tg_id, achievement_key)
);

alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
revoke all on table public.achievements from public, anon, authenticated;
revoke all on table public.user_achievements from public, anon, authenticated;

-- ------------------------------------------------------------
-- check_achievements — пересчитывает критерии и разблокирует новые.
-- Возвращает ТОЛЬКО только что разблокированные (для тоста на клиенте):
-- insert ... on conflict do nothing ... returning отдаёт лишь новые строки.
-- ------------------------------------------------------------
create or replace function public.check_achievements(p_tg_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel_count  integer;
  v_win_count   integer := 0;
  v_streak      integer := 0;
  v_total_score integer;
  v_categories  integer;
  v_perfect     boolean;
  v_ace         boolean;
  v_keys        text[] := '{}';
  v_newly       jsonb;
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

  if v_duel_count >= 1                  then v_keys := array_append(v_keys, 'first_duel');     end if;
  if v_win_count >= 10                  then v_keys := array_append(v_keys, 'duel_wins_10');   end if;
  if v_streak >= 3                      then v_keys := array_append(v_keys, 'win_streak_3');   end if;
  if v_perfect                          then v_keys := array_append(v_keys, 'perfect_solo');   end if;
  if v_ace                              then v_keys := array_append(v_keys, 'sprint_ace');     end if;
  if v_categories >= 10                 then v_keys := array_append(v_keys, 'all_categories'); end if;
  if coalesce(v_total_score, 0) >= 5000 then v_keys := array_append(v_keys, 'score_5000');     end if;

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
-- get_achievements — полный каталог + статус для конкретного игрока
-- ------------------------------------------------------------
create or replace function public.get_achievements(p_tg_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'key',         a.key,
           'title',       a.title,
           'description', a.description,
           'icon',        a.icon,
           'unlocked_at', ua.unlocked_at
         ) order by (ua.unlocked_at is null), ua.unlocked_at desc, a.key), '[]'::jsonb)
    into v_result
    from public.achievements a
    left join public.user_achievements ua
      on ua.achievement_key = a.key and ua.tg_id = p_tg_id;

  return v_result;
end $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.check_achievements(bigint)',
    'public.get_achievements(bigint)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
