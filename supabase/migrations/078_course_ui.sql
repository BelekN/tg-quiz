-- ============================================================
-- Подписи интерфейса, зависящие от темы курса (courses.ui): у
-- «Логических уловок» кнопки «Честный довод / Уловка», у «Когнитивных
-- искажений» — «Трезвая мысль / Искажение» и т.п. Пустой объект =
-- значения по умолчанию на клиенте (DEFAULT_UI в src/lib/course.js).
-- Отдаём только в get_course: урок и сертификат открываются с экрана
-- курса и берут ui оттуда.
-- ============================================================

alter table public.courses add column if not exists ui jsonb not null default '{}'::jsonb;

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
                       and (v_enr.last_completed_on is null or v_enr.last_completed_on < current_date),
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
