-- ============================================================
-- Магазин, часть 1: косметика за монеты + журнал покупок за Stars.
--
-- Экономика: единая мягкая валюта — монеты. Их можно заработать игрой
-- (как и раньше) ИЛИ купить пачками за Telegram Stars (настоящие
-- деньги) — обмен реализован в tg-api/create_stars_invoice +
-- tg-webhook (successful_payment). Косметика продаётся только за
-- монеты, не напрямую за Stars — так у бесплатных игроков остаётся
-- путь к тому же самому, просто дольше.
--
-- v1 косметики — только рамки аватарки (avatar_frame): чистый CSS
-- (градиент/цвет), без новых картинок. Ключи и цены — здесь; сам
-- визуал (какой градиент) — в src/lib/frames.js, тот же подход, что
-- у avatar_key (ключи в БД, картинки в коде, см. avatars.js).
-- ============================================================

create table if not exists public.cosmetic_items (
  key         text primary key,
  type        text not null default 'avatar_frame',
  title       text not null,
  price_coins integer not null check (price_coins >= 0),
  ord         integer not null default 0,
  is_active   boolean not null default true
);

create table if not exists public.user_cosmetics (
  tg_id       bigint not null references public.users (tg_id) on delete cascade,
  item_key    text not null references public.cosmetic_items (key),
  unlocked_at timestamptz not null default now(),
  primary key (tg_id, item_key)
);

alter table public.users add column if not exists equipped_frame text
  references public.cosmetic_items (key);

alter table public.cosmetic_items enable row level security;
alter table public.user_cosmetics enable row level security;
revoke all on table public.cosmetic_items from public, anon, authenticated;
revoke all on table public.user_cosmetics from public, anon, authenticated;

insert into public.cosmetic_items (key, title, price_coins, ord) values
  ('frame_gold',       'Золотое кольцо',   300, 1),
  ('frame_neon_blue',  'Неоновый синий',   300, 2),
  ('frame_neon_pink',  'Неоновый розовый', 300, 3),
  ('frame_rainbow',    'Радуга',           600, 4)
on conflict (key) do update set
  title       = excluded.title,
  price_coins = excluded.price_coins,
  ord         = excluded.ord;

-- ------------------------------------------------------------
-- Журнал покупок за Stars — идемпотентность по telegram_charge_id:
-- Telegram может повторно прислать webhook-update, unique constraint
-- не даст начислить монеты дважды за один и тот же платёж.
-- ------------------------------------------------------------
create table if not exists public.star_purchases (
  id                  uuid primary key default gen_random_uuid(),
  tg_id               bigint  not null references public.users (tg_id) on delete cascade,
  telegram_charge_id  text    not null unique,
  pack_key            text    not null,
  stars_amount        integer not null,
  coins_credited      integer not null,
  created_at          timestamptz not null default now()
);

alter table public.star_purchases enable row level security;
revoke all on table public.star_purchases from public, anon, authenticated;

-- ------------------------------------------------------------
-- get_shop_cosmetics — каталог + что уже куплено/надето
-- ------------------------------------------------------------
create or replace function public.get_shop_cosmetics(p_tg_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_equipped text;
  v_result   jsonb;
begin
  select equipped_frame into v_equipped from public.users where tg_id = p_tg_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'key',         c.key,
           'title',       c.title,
           'price_coins', c.price_coins,
           'owned',       (uc.tg_id is not null),
           'equipped',    coalesce(c.key = v_equipped, false)
         ) order by c.ord), '[]'::jsonb)
    into v_result
    from public.cosmetic_items c
    left join public.user_cosmetics uc on uc.item_key = c.key and uc.tg_id = p_tg_id
   where c.is_active;

  return v_result;
end $$;

revoke all on function public.get_shop_cosmetics(bigint) from public, anon, authenticated;
grant execute on function public.get_shop_cosmetics(bigint) to service_role;

-- ------------------------------------------------------------
-- buy_cosmetic — атомарная проверка+списание в одном UPDATE
-- (не read-then-write: гонка из двух одновременных покупок не
-- может дважды списать одни и те же монеты).
-- ------------------------------------------------------------
create or replace function public.buy_cosmetic(
  p_tg_id    bigint,
  p_item_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.cosmetic_items;
  v_user public.users;
begin
  select * into v_item from public.cosmetic_items
   where key = p_item_key and is_active
   for update;
  if not found then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.user_cosmetics where tg_id = p_tg_id and item_key = p_item_key
  ) then
    raise exception 'ALREADY_OWNED';
  end if;

  update public.users
     set coins = coins - v_item.price_coins, updated_at = now()
   where tg_id = p_tg_id and coins >= v_item.price_coins
  returning * into v_user;

  if not found then
    raise exception 'NOT_ENOUGH_COINS';
  end if;

  insert into public.user_cosmetics (tg_id, item_key) values (p_tg_id, p_item_key);

  return jsonb_build_object('user', to_jsonb(v_user), 'item_key', p_item_key);
end $$;

revoke all on function public.buy_cosmetic(bigint, text) from public, anon, authenticated;
grant execute on function public.buy_cosmetic(bigint, text) to service_role;

-- ------------------------------------------------------------
-- equip_frame — p_item_key = null снимает рамку
-- ------------------------------------------------------------
create or replace function public.equip_frame(
  p_tg_id    bigint,
  p_item_key text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
begin
  if p_item_key is not null and not exists (
    select 1 from public.user_cosmetics where tg_id = p_tg_id and item_key = p_item_key
  ) then
    raise exception 'NOT_OWNED';
  end if;

  update public.users
     set equipped_frame = p_item_key, updated_at = now()
   where tg_id = p_tg_id
  returning * into v_user;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  return v_user;
end $$;

revoke all on function public.equip_frame(bigint, text) from public, anon, authenticated;
grant execute on function public.equip_frame(bigint, text) to service_role;

-- ------------------------------------------------------------
-- credit_star_purchase — вызывается ТОЛЬКО из tg-webhook по факту
-- реального successful_payment от Telegram, никогда по запросу
-- клиента (иначе можно было бы просто попросить начислить монеты
-- без оплаты).
-- ------------------------------------------------------------
create or replace function public.credit_star_purchase(
  p_tg_id              bigint,
  p_telegram_charge_id text,
  p_pack_key           text,
  p_stars_amount       integer,
  p_coins_to_credit    integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    public.users;
  v_inserted boolean;
begin
  insert into public.star_purchases
    (tg_id, telegram_charge_id, pack_key, stars_amount, coins_credited)
  values
    (p_tg_id, p_telegram_charge_id, p_pack_key, p_stars_amount, p_coins_to_credit)
  on conflict (telegram_charge_id) do nothing;

  v_inserted := found;

  if not v_inserted then
    -- этот платёж уже обработан раньше (повтор webhook) — не начисляем
    -- повторно, просто возвращаем текущий баланс.
    select * into v_user from public.users where tg_id = p_tg_id;
    return jsonb_build_object('user', to_jsonb(v_user), 'already_processed', true);
  end if;

  update public.users
     set coins = coins + p_coins_to_credit, updated_at = now()
   where tg_id = p_tg_id
  returning * into v_user;

  return jsonb_build_object('user', to_jsonb(v_user), 'already_processed', false);
end $$;

revoke all on function public.credit_star_purchase(bigint, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.credit_star_purchase(bigint, text, text, integer, integer)
  to service_role;

-- ------------------------------------------------------------
-- get_leaderboard — переиздана с equipped_frame, чтобы рамки было
-- видно и у других игроков в рейтинге (весь смысл косметики —
-- показать её другим).
-- ------------------------------------------------------------
create or replace function public.get_leaderboard(
  p_tg_id  bigint,
  p_limit  integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_top jsonb;
  v_me  jsonb;
begin
  select jsonb_agg(t) into v_top
    from (
      select
        row_number() over (order by total_score desc, tg_id asc) as rank,
        tg_id, username, first_name, photo_url, avatar_key, equipped_frame, city, total_score, coins
      from public.users
      order by total_score desc, tg_id asc
      limit p_limit
    ) t;

  select to_jsonb(r) into v_me
    from (
      select
        row_number() over (order by total_score desc, tg_id asc) as rank,
        tg_id, username, first_name, photo_url, avatar_key, equipped_frame, city, total_score, coins
      from public.users
    ) r
   where r.tg_id = p_tg_id;

  return jsonb_build_object(
    'top', coalesce(v_top, '[]'::jsonb),
    'me',  v_me
  );
end $$;
