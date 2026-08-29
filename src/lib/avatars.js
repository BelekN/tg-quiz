import { PAID_AVATAR_META } from './paidAvatars'

/**
 * Бесплатных пресетов аватарок больше нет — весь набор теперь платный
 * (см. paidAvatars.js + Магазин, раздел «Аватарки»).
 */
export const avatarUrl = (key) => (PAID_AVATAR_META[key] ? `/avatars/${PAID_AVATAR_META[key]}` : null)

/** Выбранная в приложении аватарка важнее фото из Telegram. */
export const resolveAvatarSrc = (avatarKey, photoUrl) =>
  avatarUrl(avatarKey) || photoUrl || null
