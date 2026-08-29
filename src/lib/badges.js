/**
 * Титулы у имени — чистый текст/эмодзи, без картинок. Ключ — то, что
 * хранится в users.equipped_badge и в каталоге public.cosmetic_items
 * (см. 043_shop_v2.sql). Текст дублирует title из БД — тот же принцип,
 * что у avatar_key/frame_key (см. avatars.js, frames.js): каталог и
 * цена — в БД, как это показать — здесь.
 */
export const BADGE_META = {
  badge_lucky: { label: '🍀 Счастливчик' },
  badge_gambler: { label: '🎲 Азартный' },
  badge_erudite: { label: '🧠 Эрудит' },
  badge_speedster: { label: '⚡ Скоростной' },
  badge_sharpshooter: { label: '🎯 Точный расчёт' },
  badge_invincible: { label: '🔥 Непобедимый' },
  badge_legend: { label: '👑 Легенда викторин' },
  badge_champion: { label: '🏆 Чемпион' },
}

export const badgeLabel = (key) => BADGE_META[key]?.label ?? null
