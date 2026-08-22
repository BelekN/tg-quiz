import {
  init,
  isTMA,
  initData,
  miniApp,
  themeParams,
  viewport,
  hapticFeedback,
  shareURL,
  mockTelegramEnv,
  retrieveRawInitData,
} from '@telegram-apps/sdk'

let booted = false

/**
 * Поднимает SDK. Вызывать один раз, до первого рендера данных.
 * bindCssVars прокидывает палитру Telegram в CSS-переменные
 * (--tg-theme-*), на них опирается тема в index.css.
 */
export function initTelegram() {
  if (booted) return
  booted = true

  // Вне Telegram (обычный `npm run dev`) подкладываем окружение,
  // иначе init() упадёт. Подпись у мока НЕвалидная — запросы
  // к Edge Function такой initData не примет, это ожидаемо.
  // mockTelegramEnv тоже может бросить (например, если версия
  // @telegram-apps/bridge однажды ужесточит LaunchParamsSchema) —
  // ловим здесь же, а не даём уронить весь модуль.
  try {
    if (import.meta.env.DEV && !isTMA()) {
      mockDevEnv()
    }
    init()
    initData.restore()
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[telegram] init failed:', e)
    return
  }

  safely(() => {
    miniApp.mountSync()
    miniApp.bindCssVars()
  })
  safely(() => {
    themeParams.mountSync()
    themeParams.bindCssVars()
  })
  viewport
    .mount()
    .then(() => {
      safely(() => viewport.bindCssVars())
      safely(() => viewport.expand())
    })
    .catch(() => {})

  safely(() => miniApp.ready())
}

function safely(fn) {
  try {
    fn()
  } catch {
    /* метод не поддержан этой версией клиента — не критично */
  }
}

function mockDevEnv() {
  // Можно положить в .env реальный initData, скопированный из
  // Telegram-клиента — тогда и запросы к бэкенду заработают.
  const raw =
    import.meta.env.VITE_DEV_INIT_DATA ||
    new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      hash: 'devhash',
      signature: 'devsignature',
      user: JSON.stringify({
        id: 99281932,
        first_name: 'Dev',
        username: 'dev_user',
        language_code: 'ru',
      }),
    }).toString()

  // LaunchParamsSchema требует tgWebAppPlatform/Version/ThemeParams
  // на верхнем уровне — без них валидация всего объекта падает
  // с InvalidLaunchParamsError ещё до разбора tgWebAppData.
  mockTelegramEnv({
    launchParams: {
      tgWebAppData: raw,
      tgWebAppPlatform: 'tdesktop',
      tgWebAppVersion: '8',
      tgWebAppThemeParams: {
        bg_color: '#17212b',
        secondary_bg_color: '#1f2c3a',
        section_bg_color: '#232e3c',
        text_color: '#ffffff',
        hint_color: '#8a9bab',
        link_color: '#62bcf9',
        button_color: '#40a7e3',
        button_text_color: '#ffffff',
        destructive_text_color: '#ec3942',
      },
    },
  })
}

/** { id, username, firstName, photoUrl } либо null */
export function getTgUser() {
  try {
    return initData.user() ?? null
  } catch {
    return null
  }
}

/** start_param из ссылки: duel_<uuid> */
export function getStartParam() {
  try {
    return initData.startParam() ?? null
  } catch {
    return null
  }
}

/** Сырая строка initData — уходит в Authorization: tma <...> */
export function getRawInitData() {
  try {
    return retrieveRawInitData() ?? initData.raw() ?? ''
  } catch {
    return ''
  }
}

export const haptic = {
  tap: () => safely(() => hapticFeedback.impactOccurred('light')),
  success: () => safely(() => hapticFeedback.notificationOccurred('success')),
  error: () => safely(() => hapticFeedback.notificationOccurred('error')),
}

/**
 * Открывает нативный шэринг Telegram со ссылкой-приглашением.
 *
 * ВАЖНО: для Mini App нужен именно ?startapp=, а не ?start=.
 * ?start=  -> открывает ЧАТ С БОТОМ и посылает /start duel_<id>,
 *             мини-апп при этом не открывается;
 * ?startapp=-> открывает саму мини-аппу, а значение попадает
 *             в initData.startParam.
 */
export function shareDuelLink(duelId, text) {
  const bot = import.meta.env.VITE_BOT_USERNAME
  const app = import.meta.env.VITE_APP_SHORT_NAME
  const url = app
    ? `https://t.me/${bot}/${app}?startapp=duel_${duelId}`
    : `https://t.me/${bot}?startapp=duel_${duelId}`

  try {
    shareURL(url, text)
  } catch {
    // фолбэк для браузера/дева
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      '_blank',
    )
  }
  return url
}
