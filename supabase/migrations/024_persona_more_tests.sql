-- ------------------------------------------------------------
-- Доводим "Кто ты из..." до 10 тестов: скрываем "Какой ты
-- разработчик?" (слишком нишевый) вместо удаления — у части
-- пользователей уже есть реальные завершённые сессии на нём
-- (persona_sessions.test_key -> persona_tests(key) без cascade,
-- удаление строки сломало бы их историю). is_active скрывает тест
-- из каталога, но get_history всё равно резолвит старые записи через
-- обычный join, не через get_persona_tests.
-- ------------------------------------------------------------
alter table public.persona_tests add column if not exists is_active boolean not null default true;

update public.persona_tests set is_active = false where key = 'dev_archetype';

create or replace function public.get_persona_tests()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'key', key, 'title', title, 'description', description, 'icon', icon
         ) order by ord), '[]'::jsonb)
    from public.persona_tests
   where is_active;
$$;
