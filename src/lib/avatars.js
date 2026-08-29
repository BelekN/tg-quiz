/** Готовые аватарки на выбор. Ключ — то, что хранится в users.avatar_key. */
export const AVATAR_META = {
  fox: { file: 'avatar-01.png', label: 'Лиса' },
  owl: { file: 'avatar-02.png', label: 'Сова' },
  cat: { file: 'avatar-03.png', label: 'Кот' },
  robot: { file: 'avatar-04.png', label: 'Робот' },
  dragon: { file: 'avatar-05.png', label: 'Дракон' },
  panda: { file: 'avatar-06.png', label: 'Панда' },
  lion: { file: 'avatar-07.png', label: 'Лев' },
  octopus: { file: 'avatar-08.png', label: 'Осьминог' },
  alien: { file: 'avatar-09.png', label: 'Инопланетянин' },
  astronaut: { file: 'avatar-10.png', label: 'Космонавт' },
  frog: { file: 'avatar-11.png', label: 'Лягушка' },
}

export const AVATAR_KEYS = Object.keys(AVATAR_META)

export const avatarUrl = (key) =>
  AVATAR_META[key] ? `/avatars/${AVATAR_META[key].file}` : null

/** Выбранная в приложении аватарка важнее фото из Telegram. */
export const resolveAvatarSrc = (avatarKey, photoUrl) =>
  avatarUrl(avatarKey) || photoUrl || null
