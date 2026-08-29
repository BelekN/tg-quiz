/**
 * Косметические рамки аватарки — чистый CSS (градиент/цвет), без
 * новых картинок. Ключ — то, что хранится в users.equipped_frame и
 * в каталоге public.cosmetic_items (см. 042_shop.sql); цена и факт
 * владения приходят с сервера, сам визуал — только здесь, тот же
 * подход, что у avatar_key/AVATAR_META в avatars.js.
 *
 * tier — чисто визуальная градация по цене (не хранится в БД, просто
 * группировка "дешёвые/дорогие" по факту продажной цены в
 * 054_shop_more_items.sql): чем дороже рамка, тем толще кольцо и
 * заметнее свечение — иначе differences между рамками виден только
 * по цвету, а не по "статусности", и дорогая рамка не читается как
 * дорогая на глаз.
 */
const TIER_STYLE = {
  1: { ring: 2, glow: null },
  2: { ring: 3, glow: '0 0 6px rgba(255,255,255,.3)' },
  3: { ring: 3.5, glow: '0 0 10px rgba(255,255,255,.4)' },
  4: { ring: 4.5, glow: '0 0 16px rgba(255,255,255,.55)' },
}

export const FRAME_META = {
  // tier 1 — самые дешёвые (140 монет)
  frame_gold: { background: 'linear-gradient(135deg, #ffe08a, #b8860b)', tier: 1 },
  frame_neon_blue: { background: 'linear-gradient(135deg, #8be9ff, #1f7fff)', tier: 1 },
  frame_neon_pink: { background: 'linear-gradient(135deg, #ff9ad5, #ff2d9e)', tier: 1 },
  frame_silver: { background: 'linear-gradient(135deg, #e8e8e8, #9ca3af)', tier: 1 },
  // tier 2 (180 монет)
  frame_fire: { background: 'linear-gradient(135deg, #ffb703, #fb5607, #d00000)', tier: 2 },
  frame_ice: { background: 'linear-gradient(135deg, #caf0f8, #48cae4, #0077b6)', tier: 2 },
  // tier 3 (220 монет)
  frame_emerald: { background: 'linear-gradient(135deg, #8ef0c0, #10b981, #065f46)', tier: 3 },
  frame_amethyst: { background: 'linear-gradient(135deg, #e0c3fc, #9d4edd, #5a189a)', tier: 3 },
  // tier 4 — самая дорогая (300 монет)
  frame_rainbow: {
    background: 'linear-gradient(135deg, #ff5e5e, #ffd166, #4ade80, #38bdf8, #a78bfa)',
    tier: 4,
  },
}

export const frameBackground = (key) => FRAME_META[key]?.background ?? null

/** -> { ring: px, glow: box-shadow | null } — толщина кольца и свечение по тиру рамки. */
export const frameStyle = (key) => {
  const tier = FRAME_META[key]?.tier ?? 1
  return TIER_STYLE[tier]
}
