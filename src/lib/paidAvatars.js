/**
 * Платные аватарки — тот же принцип, что у frames.js/badges.js: цена
 * и факт владения приходят с сервера (cosmetic_items, type=
 * 'avatar_image'), сама картинка — только здесь. Ключ — то же самое
 * значение, что хранится в users.avatar_key после покупки+экипировки
 * (см. set_avatar в 057_paid_avatars.sql).
 */
export const PAID_AVATAR_META = {
  avatar_frog: 'paid/avatar_frog.png',
  avatar_sloth: 'paid/avatar_sloth.png',
  avatar_cat: 'paid/avatar_cat.png',
  avatar_deer: 'paid/avatar_deer.png',
  avatar_fox: 'paid/avatar_fox.png',
  avatar_koala: 'paid/avatar_koala.png',
  avatar_elephant: 'paid/avatar_elephant.png',
  avatar_penguin: 'paid/avatar_penguin.png',
  avatar_panda: 'paid/avatar_panda.png',
  avatar_crocodile: 'paid/avatar_crocodile.png',
  avatar_lion: 'paid/avatar_lion.png',
  avatar_tiger: 'paid/avatar_tiger.png',
}
