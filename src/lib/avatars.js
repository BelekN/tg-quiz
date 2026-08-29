import { PAID_AVATAR_META } from './paidAvatars'

/**
 * Бесплатных пресетов аватарок больше нет — весь набор аватарок
 * теперь платный (см. paidAvatars.js + магазин). AVATAR_META оставлен
 * пустым, а не удалён совсем: AvatarPickerScreen и старый код по
 * users.avatar_key продолжают работать без изменений, просто сетка
 * выбора пуста, пока не куплена хотя бы одна платная аватарка.
 */
export const AVATAR_META = {}

export const AVATAR_KEYS = Object.keys(AVATAR_META)

export const avatarUrl = (key) => {
  if (AVATAR_META[key]) return `/avatars/${AVATAR_META[key].file}`
  if (PAID_AVATAR_META[key]) return `/avatars/${PAID_AVATAR_META[key]}`
  return null
}

/** Выбранная в приложении аватарка важнее фото из Telegram. */
export const resolveAvatarSrc = (avatarKey, photoUrl) =>
  avatarUrl(avatarKey) || photoUrl || null
