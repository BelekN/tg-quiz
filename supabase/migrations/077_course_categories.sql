-- ============================================================
-- Разделы по темам во вкладке «Учёба»: курсов будет много, плоский
-- список перестанет читаться. Раздел — простой ключ на courses (не
-- отдельная таблица): названия/иконки/порядок разделов живут на
-- клиенте (src/lib/learnCatalog.js) рядом с анонсами «Скоро», которых
-- в базе нет вовсе.
-- ============================================================

alter table public.courses add column if not exists category text not null default 'thinking';

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
         ) order by c.ord), '[]'::jsonb)
    from public.courses c
    left join public.course_enrollments e on e.course_key = c.key and e.tg_id = p_tg_id
   where c.is_active;
$$;

revoke all on function public.get_courses(bigint) from public, anon, authenticated;
grant execute on function public.get_courses(bigint) to service_role;
