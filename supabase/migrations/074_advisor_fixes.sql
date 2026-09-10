-- ============================================================
-- Правим предупреждения Supabase Security/Performance Advisor
-- (снят полный список через Management API 2026-09-10).
--
-- Что фиксим:
-- 1. function_search_path_mutable (WARN) — четыре чистые
--    вспомогательные SQL/PLpgSQL функции без `set search_path`.
--    Все обращения к другим объектам в них либо отсутствуют, либо уже
--    полностью квалифицированы (`public.numerology_digit_sum` внутри
--    numerology_reduce), так что `search_path = ''` ничего не ломает —
--    просто закрывает теоретическую дыру для подмены объекта поиском
--    по незафиксированному search_path.
-- 2. no_primary_key (INFO) — у referrals не было PK, только UNIQUE на
--    referred_tg_id. Меняем unique-constraint на primary key на той же
--    колонке (семантика та же, просто один индекс вместо потенциально
--    задвоенного).
--
-- Что НЕ трогаем и почему:
-- - extension_in_public (pg_net зарегистрирован в схеме public) —
--   у pg_net все реальные функции (net.http_post и т.д.) и так лежат в
--   собственной схеме `net`, в public по факту ничего чувствительного
--   нет. "Переезд" расширения ломок не даёт зафиксировать без
--   пересоздания (drop/create), а это рискует зацепить существующие
--   pg_cron джобы (tg-cron пуши). Не стоит той свечки при текущем
--   реальном риске — оставляем как есть.
-- - rls_enabled_no_policy (34 таблицы, INFO) — это наш осознанный
--   паттерн: RLS включён без единой политики => anon/authenticated не
--   видят вообще ничего, весь трафик идёт через service_role в Edge
--   Functions. Advisor не различает "забыли policy" и "специально
--   заблокировали всё", так что предупреждение ожидаемое и безопасное.
-- - unindexed_foreign_keys (20 шт, INFO, PERFORMANCE) — не про
--   безопасность, а про производительность на масштабе, которого пока
--   нет. Можно сделать отдельным заходом при необходимости.
-- ============================================================

alter function public.shuffle_options(text[], text) set search_path = '';
alter function public.shuffled_correct_index(text[], text, integer) set search_path = '';
alter function public.numerology_digit_sum(integer) set search_path = '';
alter function public.numerology_reduce(integer, boolean) set search_path = '';

alter table public.referrals drop constraint referrals_referred_tg_id_key;
alter table public.referrals add primary key (referred_tg_id);
