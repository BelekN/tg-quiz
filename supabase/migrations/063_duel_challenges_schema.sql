-- ============================================================
-- Схема для адресных вызовов на дуэль (см. план): новый статус для
-- дуэли, ждущей решения конкретного человека, плюс кого именно вызвали.
-- Отдельная миграция от 064 — ALTER TYPE ... ADD VALUE нельзя
-- использовать в той же транзакции, где значение уже участвует в
-- других операторах (например, в теле новой функции).
-- ============================================================

alter type public.duel_status add value 'invited';
alter type public.duel_status add value 'declined';

alter table public.duels
  add column invited_tg_id bigint references public.users(tg_id) on delete set null;
