-- ------------------------------------------------------------
-- Rate limiting для tg-api: fixed-window счётчик на tg_id
-- ------------------------------------------------------------
-- До этого ничего не мешало одному initData засыпать tg-api запросами.
-- check_rate_limit — атомарный upsert (одна строка, один INSERT ON
-- CONFLICT), без гонки "прочитал-потом-обновил": окно и счётчик
-- сбрасываются/увеличиваются в одном выражении под блокировкой строки.

create table if not exists public.rate_limits (
  tg_id          bigint primary key,
  window_start   timestamptz not null default now(),
  request_count  integer     not null default 0
);

alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from public, anon, authenticated;

create or replace function public.check_rate_limit(
  p_tg_id           bigint,
  p_limit           integer default 40,
  p_window_seconds  integer default 10
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.rate_limits;
begin
  insert into public.rate_limits (tg_id, window_start, request_count)
  values (p_tg_id, now(), 1)
  on conflict (tg_id) do update
    set request_count = case
          when public.rate_limits.window_start
               < now() - (p_window_seconds || ' seconds')::interval
          then 1
          else public.rate_limits.request_count + 1
        end,
        window_start = case
          when public.rate_limits.window_start
               < now() - (p_window_seconds || ' seconds')::interval
          then now()
          else public.rate_limits.window_start
        end
  returning * into v_row;

  return v_row.request_count <= p_limit;
end $$;

revoke all on function public.check_rate_limit(bigint, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_rate_limit(bigint, integer, integer)
  to service_role;
