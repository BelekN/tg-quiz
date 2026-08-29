-- ============================================================
-- Магазин теперь рисуется сеткой 4 в ряд (см. ShopScreen.jsx) — этой
-- миграцией выравниваем каталог под неё:
--
--  * Аватарки (12 шт, уже кратно 4) — перераспределяем лев/тигр так,
--    чтобы каждый ряд из 4 был одной ценой: 200 / 260 / 320.
--  * Рамки — было 9 разномастных (140×4, 180×2, 220×2, 300×1), теперь
--    3 полных ряда по 4: 140 / 220 / 320. Добавляем 3 новые рамки
--    (aurora/galaxy/phoenix, чистый CSS-градиент — картинки не нужны)
--    в самый дорогой ряд, чтобы он тоже был полным.
--  * Расходники — было 3 в одном ряду; по просьбе пользователя в
--    ряду с одной ценой на строку расходники — исключение: все 4
--    должны быть РАЗНОЙ цены. Добавляем ×10 за 500.
-- ============================================================

-- Аватарки: лев/тигр были единственным неполным тиром (380×2) —
-- разводим их по двум другим рядам, чтобы все три ряда были по 4.
update public.cosmetic_items set price_coins = 260, ord = 25 where key = 'avatar_tiger';
update public.cosmetic_items set price_coins = 320, ord = 29 where key = 'avatar_lion';
update public.cosmetic_items set ord = 26 where key = 'avatar_penguin';
update public.cosmetic_items set ord = 27 where key = 'avatar_panda';
update public.cosmetic_items set ord = 28 where key = 'avatar_crocodile';

-- Рамки: выравниваем существующие 9 под три ровных тира.
update public.cosmetic_items set price_coins = 220 where key in ('frame_fire', 'frame_ice');
update public.cosmetic_items set price_coins = 320 where key = 'frame_rainbow';

insert into public.cosmetic_items (key, type, title, price_coins, ord, stackable, quantity) values
  ('frame_aurora',  'avatar_frame', 'Аврора',  320, 30, false, 1),
  ('frame_galaxy',  'avatar_frame', 'Галактика', 320, 31, false, 1),
  ('frame_phoenix', 'avatar_frame', 'Феникс',  320, 32, false, 1)
on conflict (key) do update set
  type=excluded.type, title=excluded.title, price_coins=excluded.price_coins,
  ord=excluded.ord, stackable=excluded.stackable, quantity=excluded.quantity;

-- Расходники: 4-й пакет, чтобы заполнить ряд — цена у каждого своя.
insert into public.cosmetic_items (key, type, title, price_coins, ord, stackable, quantity) values
  ('streak_freeze_10', 'streak_freeze', '🧊 Заморозка ×10', 500, 33, true, 10)
on conflict (key) do update set
  type=excluded.type, title=excluded.title, price_coins=excluded.price_coins,
  ord=excluded.ord, stackable=excluded.stackable, quantity=excluded.quantity;
