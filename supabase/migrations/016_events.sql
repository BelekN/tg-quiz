-- ------------------------------------------------------------
-- Лог базовых событий — фундамент для воронки, умного тайминга
-- пушей и A/B (кто, что, когда сделал).
-- ------------------------------------------------------------
create table if not exists public.events (
  id         bigint generated always as identity primary key,
  tg_id      bigint references public.users (tg_id) on delete set null,
  name       text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_tg_idx on public.events (tg_id, created_at desc);
create index if not exists events_name_idx on public.events (name, created_at desc);

alter table public.events enable row level security;
revoke all on table public.events from public, anon, authenticated;

create or replace function public.log_event(
  p_tg_id   bigint,
  p_name    text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.events (tg_id, name, payload) values (p_tg_id, p_name, p_payload);
end $$;

revoke all on function public.log_event(bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.log_event(bigint, text, jsonb) to service_role;
