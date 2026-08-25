-- ============================================================
-- Ручное начисление монет (поддержка: "оплатил Stars, монеты не
-- пришли" + свои тесты). Не через клиент — команда бота /credit,
-- доступная только тому, чей tg_id совпадает с SUPPORT_TG_ID (см.
-- tg-webhook). Каждое начисление логируется отдельно от игровых
-- событий — это ручная правка баланса, а не игровое событие.
-- ============================================================

create table if not exists public.coin_adjustments (
  id         uuid primary key default gen_random_uuid(),
  tg_id      bigint  not null references public.users (tg_id) on delete cascade,
  amount     integer not null,
  reason     text,
  created_at timestamptz not null default now()
);

alter table public.coin_adjustments enable row level security;
revoke all on table public.coin_adjustments from public, anon, authenticated;

create or replace function public.admin_credit_coins(
  p_tg_id  bigint,
  p_amount integer,
  p_reason text default null
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
begin
  -- Сначала само начисление, лог — только если пользователь реально
  -- существует: иначе coin_adjustments.tg_id (FK на users) упал бы
  -- с ошибкой констрейнта раньше, чем мы успели бы отдать понятный
  -- USER_NOT_FOUND, а неудавшаяся попытка не должна попадать в лог.
  update public.users
     -- greatest(0, ...) — если по ошибке ушли в минус, баланс просто
     -- дойдёт до нуля, а не упадёт в constraint-ошибку (coins >= 0).
     set coins = greatest(0, coins + p_amount), updated_at = now()
   where tg_id = p_tg_id
  returning * into v_user;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  insert into public.coin_adjustments (tg_id, amount, reason)
  values (p_tg_id, p_amount, p_reason);

  return v_user;
end $$;

revoke all on function public.admin_credit_coins(bigint, integer, text) from public, anon, authenticated;
grant execute on function public.admin_credit_coins(bigint, integer, text) to service_role;
