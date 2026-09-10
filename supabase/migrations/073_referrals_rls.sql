-- ============================================================
-- 072_referrals.sql забыл включить RLS на public.referrals — таблица
-- была публично доступна на чтение/запись/удаление через PostgREST
-- (обнаружено Supabase Security Advisor 2026-09-06). Закрываем так же,
-- как остальные таблицы: RLS включён, политик нет => anon/authenticated
-- доступа не имеют, весь трафик идёт через service_role в tg-api.
-- ============================================================

alter table public.referrals enable row level security;
