-- ------------------------------------------------------------
-- Готовые запросы для SQL Editor — читай, не запускай как миграцию.
-- Опираются на public.events (см. 016_events.sql), которую tg-api
-- заполняет на каждый "крупный" экшен (me, start_duel, finish_duel,
-- rematch_duel, start_solo, finish_solo, start_sprint, finish_sprint,
-- leaderboard, history, set_city, set_avatar) — answer_question/
-- answer_solo/answer_sprint осознанно не логируются, слишком часто.
-- ------------------------------------------------------------

-- 1) Воронка за последние 7 дней: сколько разных пользователей
--    дошли до каждого шага хотя бы раз.
select
  name,
  count(distinct tg_id) as unique_users
from public.events
where created_at > now() - interval '7 days'
group by name
order by unique_users desc;

-- 2) Классическая воронка "открыл -> создал дуэль -> закончил дуэль"
--    (доля от предыдущего шага, а не от общего числа).
with steps as (
  select
    count(distinct tg_id) filter (where name = 'me')          as opened,
    count(distinct tg_id) filter (where name = 'start_duel')   as created,
    count(distinct tg_id) filter (where name = 'finish_duel')  as finished
  from public.events
  where created_at > now() - interval '7 days'
)
select
  opened,
  created,
  round(100.0 * created / greatest(opened, 1), 1)  as pct_opened_to_created,
  finished,
  round(100.0 * finished / greatest(created, 1), 1) as pct_created_to_finished
from steps;

-- 3) A/B пушей: у какого варианта выше отклик (заход в приложение
--    в течение 24ч после пуша). push_type: 'duel_reminder' | 'inactivity_nudge'.
with sent as (
  select tg_id, created_at, payload->>'push_type' as push_type,
         (payload->>'variant')::int as variant
  from public.events
  where name = 'push_sent'
),
responded as (
  select s.*,
    exists (
      select 1 from public.events e
       where e.tg_id = s.tg_id
         and e.name = 'me'
         and e.created_at between s.created_at and s.created_at + interval '24 hours'
    ) as opened_after
  from sent s
)
select push_type, variant,
       count(*) as sent,
       count(*) filter (where opened_after) as opened,
       round(100.0 * count(*) filter (where opened_after) / greatest(count(*), 1), 1) as pct
from responded
group by push_type, variant
order by push_type, variant;

-- 4) Кто чаще всего бросает игру ровно на одном шаге (например,
--    создал дуэль, но никогда её не заканчивал) — кандидаты на
--    отдельный ретеншн-пуш, если таких много.
select e1.tg_id, min(e1.created_at) as first_duel_created
from public.events e1
where e1.name = 'start_duel'
group by e1.tg_id
having not exists (
  select 1 from public.events e2
   where e2.tg_id = e1.tg_id and e2.name = 'finish_duel'
)
order by first_duel_created desc
limit 50;
