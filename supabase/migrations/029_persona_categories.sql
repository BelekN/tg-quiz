-- ------------------------------------------------------------
-- Категории для списка тестов "Кто ты из..." — та же идея, что уже
-- сделали для наград (028_achievement_progress.sql): вместо плоского
-- списка из 12 тестов группируем по смыслу.
-- ------------------------------------------------------------
alter table public.persona_tests add column if not exists category text not null default 'Другое';

update public.persona_tests set category = 'Поп-культура'  where key in ('gamer_type', 'movie_character', 'superhero_type');
update public.persona_tests set category = 'Психология'    where key in ('burnout_level', 'stress_response', 'conflict_style', 'inner_age');
update public.persona_tests set category = 'Отношения'     where key in ('friend_type', 'attachment_style', 'date_type');
update public.persona_tests set category = 'Стиль жизни'   where key in ('career_match', 'traveler_type');

create or replace function public.get_persona_tests()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'key', key, 'title', title, 'description', description, 'icon', icon, 'category', category
         ) order by ord), '[]'::jsonb)
    from public.persona_tests
   where is_active;
$$;
