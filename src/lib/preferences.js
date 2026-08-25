/**
 * Настройки, которые не касаются сервера и хранятся только на этом
 * устройстве (localStorage) — в отличие от reminders_enabled, который
 * это часть профиля пользователя и должен быть одинаковым на всех его
 * устройствах, поэтому живёт в public.users, а не здесь.
 */
const HAPTICS_KEY = 'kvizduel:haptics-enabled'

export function getHapticsEnabled() {
  try {
    const v = localStorage.getItem(HAPTICS_KEY)
    return v === null ? true : v === '1'
  } catch {
    return true
  }
}

export function setHapticsEnabled(enabled) {
  try {
    localStorage.setItem(HAPTICS_KEY, enabled ? '1' : '0')
  } catch {
    /* приватный режим / квота исчерпана — просто не сохраняем */
  }
}
