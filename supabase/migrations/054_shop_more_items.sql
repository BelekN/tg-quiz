-- ============================================================
-- Магазин: +2 рамки, +2 титула, +2 расходника; порядок внутри каждой
-- секции — от самого дешёвого к самому дорогому.
--
-- Заодно: у уже существующих товаров порядок (ord) не совпадал с
-- ценой (frame_rainbow за 1500 стоял ord=4, ПЕРЕД frame_silver за
-- 700 c ord=5) — миграция 043 подняла цены трём рамкам, но не
-- перенумеровала ord following. Здесь перевыставляем ord у ВСЕХ
-- товаров (не только новых), чтобы порядок реально был по цене.
--
-- Расходники "пакетами" (×3/×5) — quantity вместо жёстко зашитой +1
-- в buy_cosmetic: раньше ЛЮБОЙ stackable-товар всегда прибавлял ровно
-- 1 заморозку, что подошло бы только одиночному streak_freeze — со
-- вторым stackable-товаром это было бы тихим багом (заплатил за ×3,
-- получил +1).
-- ============================================================

alter table public.cosmetic_items add column if not exists quantity integer not null default 1
  check (quantity >= 1);

insert into public.cosmetic_items (key, type, title, price_coins, ord, stackable, quantity) values
  ('frame_gold',         'avatar_frame',  'Золотое кольцо',      700,  1, false, 1),
  ('frame_neon_blue',    'avatar_frame',  'Неоновый синий',      700,  2, false, 1),
  ('frame_neon_pink',    'avatar_frame',  'Неоновый розовый',    700,  3, false, 1),
  ('frame_silver',       'avatar_frame',  'Серебро',             700,  4, false, 1),
  ('frame_fire',         'avatar_frame',  'Огонь',               900,  5, false, 1),
  ('frame_ice',          'avatar_frame',  'Лёд',                 900,  6, false, 1),
  ('frame_emerald',      'avatar_frame',  'Изумруд',             1100, 7, false, 1),
  ('frame_amethyst',     'avatar_frame',  'Аметист',             1100, 8, false, 1),
  ('frame_rainbow',      'avatar_frame',  'Радуга',              1500, 9, false, 1),

  ('badge_lucky',        'badge',         '🍀 Счастливчик',      600,  10, false, 1),
  ('badge_erudite',      'badge',         '🧠 Эрудит',           900,  11, false, 1),
  ('badge_speedster',    'badge',         '⚡ Скоростной',       900,  12, false, 1),
  ('badge_sharpshooter', 'badge',         '🎯 Точный расчёт',    900,  13, false, 1),
  ('badge_invincible',   'badge',         '🔥 Непобедимый',      1200, 14, false, 1),
  ('badge_legend',       'badge',         '👑 Легенда викторин', 1800, 15, false, 1),

  ('streak_freeze',      'streak_freeze', '🧊 Заморозка серии',  400,  16, true,  1),
  ('streak_freeze_3',    'streak_freeze', '🧊 Заморозка ×3',     1000, 17, true,  3),
  ('streak_freeze_5',    'streak_freeze', '🧊 Заморозка ×5',     1500, 18, true,  5)
on conflict (key) do update set
  type        = excluded.type,
  title       = excluded.title,
  price_coins = excluded.price_coins,
  ord         = excluded.ord,
  stackable   = excluded.stackable,
  quantity    = excluded.quantity;

-- ------------------------------------------------------------
-- buy_cosmetic — та же функция, что в 043_shop_v2.sql, плюс
-- начисляем v_item.quantity вместо жёстко зашитой единицы.
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

  if v_item.stackable then
    update public.users
       set coins = coins - v_item.price_coins,
           streak_freezes = streak_freezes + v_item.quantity,
           updated_at = now()
     where tg_id = p_tg_id and coins >= v_item.price_coins
    returning * into v_user;

    if not found then
      raise exception 'NOT_ENOUGH_COINS';
    end if;

    return jsonb_build_object('user', to_jsonb(v_user), 'item_key', p_item_key);
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
