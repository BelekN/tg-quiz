import { ru } from '../locales/ru'

/**
 * Инфраструктура для будущей локализации. Сейчас переведён только
 * интерфейс новых экранов (Настройки, Политика, Условия, обновление) —
 * остальной текст приложения пока зашит прямо в JSX, как и раньше.
 * Заводить второй язык прямо сейчас не нужно, но добавить его позже
 * должно быть просто:
 *
 *   1. Создать src/locales/en.js с тем же набором ключей, что в ru.js.
 *   2. Импортировать и добавить в DICTS и LOCALES ниже.
 *   3. Переключатель языка в Настройках сам подхватит новый пункт.
 */
export const LOCALES = ['ru']
const DEFAULT_LOCALE = 'ru'
const DICTS = { ru }
const STORAGE_KEY = 'kvizduel:locale'

export function getLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return LOCALES.includes(saved) ? saved : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export function setLocale(locale) {
  if (!LOCALES.includes(locale)) return
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* приватный режим / квота исчерпана — останется дефолтный язык */
  }
}

/**
 * t('settings.title') -> строка текущей локали. Фолбэк: текущая
 * локаль -> ru -> сам ключ (чтобы недопереведённый кусок был виден
 * как "settings.title", а не "undefined", если когда-нибудь появится
 * язык с неполным словарём).
 */
export function t(key, vars) {
  const locale = getLocale()
  const raw = DICTS[locale]?.[key] ?? DICTS[DEFAULT_LOCALE]?.[key] ?? key
  if (!vars) return raw
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), raw)
}
