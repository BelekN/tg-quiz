-- ============================================================
-- 12-й платный аватар — Лягушка (та же картинка, что была временным
-- бесплатным 11-м аватаром до 057_paid_avatars.sql, просто теперь в
-- каталоге cosmetic_items как avatar_image). Цена — как у самого
-- дешёвого тира (простой дизайн, тот же уровень, что ленивец/кот/
-- оленёнок).
-- ============================================================

insert into public.cosmetic_items (key, type, title, price_coins, ord, stackable, quantity) values
  ('avatar_frog', 'avatar_image', 'Лягушка', 200, 30, false, 1)
on conflict (key) do update set
  type        = excluded.type,
  title       = excluded.title,
  price_coins = excluded.price_coins,
  ord         = excluded.ord,
  stackable   = excluded.stackable,
  quantity    = excluded.quantity;
