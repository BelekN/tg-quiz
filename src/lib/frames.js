/**
 * Косметические рамки аватарки — чистый CSS (градиент/цвет), без
 * новых картинок. Ключ — то, что хранится в users.equipped_frame и
 * в каталоге public.cosmetic_items (см. 042_shop.sql); цена и факт
 * владения приходят с сервера, сам визуал — только здесь, тот же
 * подход, что у avatar_key/PAID_AVATAR_META в avatars.js.
 *
 * tier — чисто визуальная градация по цене (не хранится в БД, просто
 * группировка "дешёвые/дорогие" по факту продажной цены в
 * 060_shop_row_tiers.sql, где рамки выровнены в три ровных ряда по
 * 4 штуки): 1 — простой цвет, тонкое кольцо, без переливов; 2 —
 * градиент, кольцо чуть толще; 3 — градиент + подсветка + самое
 * толстое кольцо, самые дорогие.
 */
const TIER_STYLE = {
  1: { ring: 2, glow: null },
  2: { ring: 3, glow: '0 0 8px rgba(255,255,255,.35)' },
  3: { ring: 4.5, glow: '0 0 16px rgba(255,255,255,.55)' },
}

export const FRAME_META = {
  // tier 1 — простой цвет, без переливов (140 монет)
  frame_gold: { background: '#d4af37', tier: 1 },
  frame_neon_blue: { background: '#3b82f6', tier: 1 },
  frame_neon_pink: { background: '#ec4899', tier: 1 },
  frame_silver: { background: '#9ca3af', tier: 1 },
  // tier 2 — градиент (220 монет)
  frame_fire: { background: 'linear-gradient(135deg, #ffb703, #fb5607, #d00000)', tier: 2 },
  frame_ice: { background: 'linear-gradient(135deg, #caf0f8, #48cae4, #0077b6)', tier: 2 },
  frame_emerald: { background: 'linear-gradient(135deg, #8ef0c0, #10b981, #065f46)', tier: 2 },
  frame_amethyst: { background: 'linear-gradient(135deg, #e0c3fc, #9d4edd, #5a189a)', tier: 2 },
  // tier 3 — градиент + подсветка + самое толстое кольцо (320 монет)
  frame_rainbow: {
    background: 'linear-gradient(135deg, #ff5e5e, #ffd166, #4ade80, #38bdf8, #a78bfa)',
    tier: 3,
  },
  frame_aurora: { background: 'linear-gradient(135deg, #00f5d4, #9b5de5, #f15bb5)', tier: 3 },
  frame_galaxy: { background: 'linear-gradient(135deg, #4361ee, #6a11cb, #2575fc)', tier: 3 },
  frame_phoenix: { background: 'linear-gradient(135deg, #ff512f, #f09819, #ffd700)', tier: 3 },
}

export const frameBackground = (key) => FRAME_META[key]?.background ?? null

/** -> { ring: px, glow: box-shadow | null } — толщина кольца и свечение по тиру рамки. */
export const frameStyle = (key) => {
  const tier = FRAME_META[key]?.tier ?? 1
  return TIER_STYLE[tier]
}
