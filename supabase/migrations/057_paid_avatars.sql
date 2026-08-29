-- ============================================================
-- Платные аватарки — новый тип косметики поверх уже существующих
-- cosmetic_items/user_cosmetics (тот же механизм, что у рамок/
-- титулов), только "экипировка" идёт не в отдельную колонку, а в уже
-- существующий users.avatar_key — та же самая колонка, что и у
-- бесплатных dragon/frog. Один источник истины для "какое лицо
-- показывать", просто с проверкой владения для платных ключей.
--
-- CHECK-констрейнт на avatar_key (статический список) больше не
-- годится — валидных ключей теперь динамический список (каталог +
-- владение), проверка переезжает внутрь set_avatar.
-- ============================================================

alter table public.users drop constraint if exists users_avatar_key_valid;

insert into public.cosmetic_items (key, type, title, price_coins, ord, stackable, quantity) values
  ('avatar_sloth',     'avatar_image', 'Ленивец',  200, 19, false, 1),
  ('avatar_cat',       'avatar_image', 'Кот',      200, 20, false, 1),
  ('avatar_deer',      'avatar_image', 'Оленёнок', 200, 21, false, 1),
  ('avatar_fox',       'avatar_image', 'Лиса',     260, 22, false, 1),
  ('avatar_koala',     'avatar_image', 'Коала',    260, 23, false, 1),
  ('avatar_elephant',  'avatar_image', 'Слонёнок', 260, 24, false, 1),
  ('avatar_penguin',   'avatar_image', 'Пингвин',  320, 25, false, 1),
  ('avatar_panda',     'avatar_image', 'Панда',    320, 26, false, 1),
  ('avatar_crocodile', 'avatar_image', 'Крокодил', 320, 27, false, 1),
  ('avatar_lion',      'avatar_image', 'Лев',      380, 28, false, 1),
  ('avatar_tiger',     'avatar_image', 'Тигр',     380, 29, false, 1)
on conflict (key) do update set
  type        = excluded.type,
  title       = excluded.title,
  price_coins = excluded.price_coins,
  ord         = excluded.ord,
  stackable   = excluded.stackable,
  quantity    = excluded.quantity;

-- ------------------------------------------------------------
-- set_avatar — бесплатных пресетов больше нет (весь набор
-- аватарок теперь платный, см. cosmetic_items type='avatar_image');
-- p_avatar_key либо null (фото из Telegram/инициал), либо ключ
-- купленной этим пользователем аватарки.
-- ------------------------------------------------------------
create or replace function public.set_avatar(
  p_tg_id      bigint,
  p_avatar_key text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
  v_item public.cosmetic_items;
begin
  if p_avatar_key is not null then
    select * into v_item from public.cosmetic_items
     where key = p_avatar_key and type = 'avatar_image' and is_active;
    if not found then
      raise exception 'INVALID_AVATAR';
    end if;

    if not exists (
      select 1 from public.user_cosmetics
       where tg_id = p_tg_id and item_key = p_avatar_key
    ) then
      raise exception 'NOT_OWNED';
    end if;
  end if;

  update public.users
     set avatar_key = p_avatar_key, updated_at = now()
   where tg_id = p_tg_id
  returning * into v_user;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  return v_user;
end $$;

revoke all on function public.set_avatar(bigint, text) from public, anon, authenticated;
grant execute on function public.set_avatar(bigint, text) to service_role;

-- ------------------------------------------------------------
-- get_shop_cosmetics — та же функция, что в 043_shop_v2.sql, плюс
-- ветка "equipped" для type='avatar_image' (сверяется с
-- users.avatar_key, а не с equipped_frame/equipped_badge).
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
  v_avatar_key     text;
  v_freezes        integer;
  v_result         jsonb;
begin
  select equipped_frame, equipped_badge, avatar_key, coalesce(streak_freezes, 0)
    into v_equipped_frame, v_equipped_badge, v_avatar_key, v_freezes
    from public.users where tg_id = p_tg_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'key',         c.key,
           'type',        c.type,
           'title',       c.title,
           'price_coins', c.price_coins,
           'stackable',   c.stackable,
           'owned',       case when c.stackable then null else (uc.tg_id is not null) end,
           'equipped',    case
             when c.stackable          then null
             when c.type = 'badge'         then coalesce(c.key = v_equipped_badge, false)
             when c.type = 'avatar_image'  then coalesce(c.key = v_avatar_key, false)
             else                                coalesce(c.key = v_equipped_frame, false)
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
