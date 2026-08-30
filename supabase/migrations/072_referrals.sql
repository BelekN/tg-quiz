-- ============================================================
-- Реферальная программа: приглашение по ссылке ?startapp=ref_<tg_id>.
-- Пригласивший и приглашённый получают по REWARD монет — один раз на
-- каждого приглашённого (UNIQUE на referred_tg_id не даёт заявить
-- одного и того же человека дважды, в том числе повторным заходом по
-- той же ссылке).
-- ============================================================

create table if not exists public.referrals (
  referrer_tg_id bigint not null references public.users(tg_id),
  referred_tg_id bigint not null references public.users(tg_id) unique,
  created_at timestamptz not null default now()
);

create index if not exists referrals_referrer_idx on public.referrals(referrer_tg_id);

create or replace function public.claim_referral(p_tg_id bigint, p_referrer_tg_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward constant integer := 30;
  v_rows integer;
begin
  if p_tg_id = p_referrer_tg_id then
    raise exception 'SELF_REFERRAL';
  end if;

  if not exists (select 1 from public.users where tg_id = p_referrer_tg_id) then
    raise exception 'REFERRER_NOT_FOUND';
  end if;

  insert into public.referrals (referrer_tg_id, referred_tg_id)
  values (p_referrer_tg_id, p_tg_id)
  on conflict (referred_tg_id) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'ALREADY_REFERRED';
  end if;

  update public.users set coins = coins + v_reward where tg_id = p_referrer_tg_id;
  update public.users set coins = coins + v_reward where tg_id = p_tg_id;

  return jsonb_build_object('reward', v_reward);
end $$;

revoke all on function public.claim_referral(bigint, bigint) from public, anon, authenticated;
grant execute on function public.claim_referral(bigint, bigint) to service_role;

-- Для экрана "Пригласить друга": сколько человек уже пришло по ссылке.
create or replace function public.get_referral_stats(p_tg_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.referrals where referrer_tg_id = p_tg_id;
  return jsonb_build_object('invited_count', v_count, 'coins_per_referral', 30);
end $$;

revoke all on function public.get_referral_stats(bigint) from public, anon, authenticated;
grant execute on function public.get_referral_stats(bigint) to service_role;
