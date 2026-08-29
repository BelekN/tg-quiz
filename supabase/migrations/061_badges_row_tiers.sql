-- ============================================================
-- Титулов было 6 при 4 разных ценах (120×1, 180×3, 240×1, 360×1) —
-- один тир (180) был перегружен, остальные — по одной штуке. Добавляем
-- 2 новых титула и перебалансируем так, чтобы на каждую из 4 цен
-- приходилось ровно по 2 (8 штук = ровно 2 полных ряда по 4).
--
-- Заодно переносим ord титулов в собственный диапазон (100+), чтобы
-- порядок внутри секции гарантированно шёл по возрастанию цены,
-- независимо от ord других типов (аватарки/рамки/расходники).
-- ============================================================

update public.cosmetic_items set ord = 100 where key = 'badge_lucky';
update public.cosmetic_items set ord = 102 where key = 'badge_erudite';
update public.cosmetic_items set ord = 103 where key = 'badge_speedster';
update public.cosmetic_items set ord = 104, price_coins = 240 where key = 'badge_sharpshooter';
update public.cosmetic_items set ord = 105 where key = 'badge_invincible';
update public.cosmetic_items set ord = 106 where key = 'badge_legend';

insert into public.cosmetic_items (key, type, title, price_coins, ord, stackable, quantity) values
  ('badge_gambler',  'badge', '🎲 Азартный', 120, 101, false, 1),
  ('badge_champion', 'badge', '🏆 Чемпион',  360, 107, false, 1)
on conflict (key) do update set
  type=excluded.type, title=excluded.title, price_coins=excluded.price_coins,
  ord=excluded.ord, stackable=excluded.stackable, quantity=excluded.quantity;
