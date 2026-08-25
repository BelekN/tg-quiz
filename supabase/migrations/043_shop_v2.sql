-- ============================================================
-- Магазин, часть 2: пересчёт цен + расширение каталога.
--
-- Реальные цифры заработка (см. finish_duel/finish_solo/...):
-- дуэль до 45, квиз-тест до 50, спринт ~45-60, ежедневный 25,
-- марафон 5 за верный без потолка. Активный заход по нескольким
-- режимам легко даёт 150-200 монет — старая цена 300 за рамку
-- открывалась за один такой заход. Поднимаем цены и одновременно
-- расширяем каталог, чтобы дешёвые вещи стали "стартовыми", а не
-- единственными.
--
-- Новый тип косметики — badge (титул у имени, чистый текст/эмодзи,
-- без картинок, как и рамки). И новый механизм — stackable-расходник
-- (заморозка серии): в отличие от рамки/титула, которую покупаешь
-- один раз навсегда, расходник покупается про запас (штука за
-- покупку) и тратится автоматически.
-- ============================================================

alter table public.cosmetic_items add column if not exists stackable boolean not null default false;

alter table public.users add column if not exists equipped_badge text
  references public.cosmetic_items (key);
alter table public.users add column if not exists streak_freezes integer
  not null default 0 check (streak_freezes >= 0);

-- ------------------------------------------------------------
-- Пересчёт цен существующих рамок + новый каталог целиком
-- ------------------------------------------------------------
update public.cosmetic_items set price_coins = 700  where key in ('frame_gold', 'frame_neon_blue', 'frame_neon_pink');
update public.cosmetic_items set price_coins = 1500 where key = 'frame_rainbow';

insert into public.cosmetic_items (key, type, title, price_coins, ord, stackable) values
  ('frame_silver',        'avatar_frame',  'Серебро',                700,  5, false),
  ('frame_fire',          'avatar_frame',  'Огонь',                  900,  6, false),
  ('frame_ice',           'avatar_frame',  'Лёд',                    900,  7, false),
  ('badge_erudite',       'badge',         '🧠 Эрудит',               900,  8, false),
  ('badge_speedster',     'badge',         '⚡ Скоростной',           900,  9, false),
  ('badge_sharpshooter',  'badge',         '🎯 Точный расчёт',        900, 10, false),
  ('badge_legend',        'badge',         '👑 Легенда викторин',    1800, 11, false),
  ('streak_freeze',       'streak_freeze', '🧊 Заморозка серии',      400, 12, true)
on conflict (key) do update set
  type        = excluded.type,
  title       = excluded.title,
  price_coins = excluded.price_coins,
  ord         = excluded.ord,
  stackable   = excluded.stackable;

-- ------------------------------------------------------------
-- get_shop_cosmetics — переиздана: тип, титул отдельно от рамки,
-- сток для расходников вместо owned/equipped.
-- ------------------------------------------------------------
create or replace function public.get_shop_cosmetics(p_tg_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_equipped_frame text;
  v_equipped_badge text;
  v_freezes        integer;
  v_result         jsonb;
begin
  select equipped_frame, equipped_badge, coalesce(streak_freezes, 0)
    into v_equipped_frame, v_equipped_badge, v_freezes
    from public.users where tg_id = p_tg_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'key',         c.key,
           'type',        c.type,
           'title',       c.title,
           'price_coins', c.price_coins,
           'stackable',   c.stackable,
           'owned',       case when c.stackable then null else (uc.tg_id is not null) end,
           'equipped',    case
             when c.stackable    then null
             when c.type = 'badge' then coalesce(c.key = v_equipped_badge, false)
             else                       coalesce(c.key = v_equipped_frame, false)
           end,
           'stock', case when c.stackable then v_freezes else null end
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
-- buy_cosmetic — переиздана: расходники (stackable) не проверяют
-- "уже куплено" и не пишут в user_cosmetics, просто пополняют сток.
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
           streak_freezes = streak_freezes + 1,
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

-- ------------------------------------------------------------
-- equip_badge — тот же принцип, что equip_frame, отдельная колонка
-- ------------------------------------------------------------
create or replace function public.equip_badge(
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
     set equipped_badge = p_item_key, updated_at = now()
   where tg_id = p_tg_id
  returning * into v_user;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  return v_user;
end $$;

revoke all on function public.equip_badge(bigint, text) from public, anon, authenticated;
grant execute on function public.equip_badge(bigint, text) to service_role;

-- ------------------------------------------------------------
-- get_leaderboard — переиздана с equipped_badge (титул виден и у
-- других игроков — то же соображение, что и с рамками).
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
        tg_id, username, first_name, photo_url, avatar_key, equipped_frame, equipped_badge,
        city, total_score, coins
      from public.users
      order by total_score desc, tg_id asc
      limit p_limit
    ) t;

  select to_jsonb(r) into v_me
    from (
      select
        row_number() over (order by total_score desc, tg_id asc) as rank,
        tg_id, username, first_name, photo_url, avatar_key, equipped_frame, equipped_badge,
        city, total_score, coins
      from public.users
    ) r
   where r.tg_id = p_tg_id;

  return jsonb_build_object(
    'top', coalesce(v_top, '[]'::jsonb),
    'me',  v_me
  );
end $$;

-- ------------------------------------------------------------
-- upsert_user — переиздана: если пропущен ровно один день, но есть
-- запас заморозок — серия не рвётся, тратится одна заморозка.
-- Пропуск 2+ дней заморозка не спасает (страхует один день, не
-- бессрочное отсутствие).
-- ------------------------------------------------------------
create or replace function public.upsert_user(
  p_tg_id      bigint,
  p_username   text default null,
  p_first_name text default null,
  p_photo_url  text default null
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user             public.users;
  v_prev_streak_date date;
  v_prev_streak      integer;
  v_prev_longest     integer;
  v_freezes_avail    integer;
  v_new_streak       integer;
  v_freeze_used      integer := 0;
begin
  select last_streak_date, current_streak, longest_streak, coalesce(streak_freezes, 0)
    into v_prev_streak_date, v_prev_streak, v_prev_longest, v_freezes_avail
    from public.users where tg_id = p_tg_id;

  if v_prev_streak_date is null then
    v_new_streak := 1;
  elsif v_prev_streak_date = current_date then
    v_new_streak := coalesce(v_prev_streak, 1);
  elsif v_prev_streak_date = current_date - 1 then
    v_new_streak := coalesce(v_prev_streak, 0) + 1;
  elsif v_prev_streak_date = current_date - 2 and v_freezes_avail > 0 then
    v_new_streak := coalesce(v_prev_streak, 0) + 1;
    v_freeze_used := 1;
  else
    v_new_streak := 1;
  end if;

  insert into public.users as u (
    tg_id, username, first_name, photo_url,
    current_streak, longest_streak, last_streak_date
  )
  values (
    p_tg_id, p_username, p_first_name, p_photo_url,
    v_new_streak, v_new_streak, current_date
  )
  on conflict (tg_id) do update
    set username         = coalesce(excluded.username,   u.username),
        first_name       = coalesce(excluded.first_name, u.first_name),
        photo_url        = coalesce(excluded.photo_url,  u.photo_url),
        updated_at       = now(),
        current_streak   = v_new_streak,
        longest_streak   = greatest(u.longest_streak, v_new_streak),
        last_streak_date = current_date,
        streak_freezes   = greatest(0, u.streak_freezes - v_freeze_used)
  returning * into v_user;

  return v_user;
end $$;
