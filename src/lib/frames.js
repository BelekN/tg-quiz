/**
 * Косметические рамки аватарки — чистый CSS (градиент/цвет), без
 * новых картинок. Ключ — то, что хранится в users.equipped_frame и
 * в каталоге public.cosmetic_items (см. 042_shop.sql); цена и факт
 * владения приходят с сервера, сам визуал — только здесь, тот же
 * подход, что у avatar_key/AVATAR_META в avatars.js.
 */
export const FRAME_META = {
  frame_gold: { background: 'linear-gradient(135deg, #ffe08a, #b8860b)' },
  frame_neon_blue: { background: 'linear-gradient(135deg, #8be9ff, #1f7fff)' },
  frame_neon_pink: { background: 'linear-gradient(135deg, #ff9ad5, #ff2d9e)' },
  frame_silver: { background: 'linear-gradient(135deg, #e8e8e8, #9ca3af)' },
  frame_fire: { background: 'linear-gradient(135deg, #ffb703, #fb5607, #d00000)' },
  frame_ice: { background: 'linear-gradient(135deg, #caf0f8, #48cae4, #0077b6)' },
  frame_emerald: { background: 'linear-gradient(135deg, #8ef0c0, #10b981, #065f46)' },
  frame_amethyst: { background: 'linear-gradient(135deg, #e0c3fc, #9d4edd, #5a189a)' },
  frame_rainbow: {
    background: 'linear-gradient(135deg, #ff5e5e, #ffd166, #4ade80, #38bdf8, #a78bfa)',
  },
}

export const frameBackground = (key) => FRAME_META[key]?.background ?? null
