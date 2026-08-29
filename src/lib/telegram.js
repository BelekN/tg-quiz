import {
  init,
  isTMA,
  initData,
  miniApp,
  themeParams,
  viewport,
  hapticFeedback,
  shareURL,
  shareStory,
  switchInlineQuery,
  mockTelegramEnv,
  retrieveRawInitData,
  backButton,
  mainButton,
  secondaryButton,
  requestFullscreen,
  addToHomeScreen,
  checkHomeScreenStatus,
  openInvoice,
  isInvoiceSupported,
} from '@telegram-apps/sdk'

export { openInvoice, isInvoiceSupported }
import { getHapticsEnabled } from './preferences'

export { backButton, mainButton, secondaryButton, miniApp }

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
      // Полноэкранный режим (как у Wallet) — больше места экрану,
      // хедер Telegram начинает "плавать" сверху контента вместо
      // отдельной серой плашки. Не критично, если клиент не умеет:
      // .isAvailable() уже гейтит вызов, а .catch съедает отказ,
      // если пользователь сам отменил переход в fullscreen.
      if (requestFullscreen.isAvailable()) {
        requestFullscreen().catch(() => {})
      }
    })
    .catch(() => {})

  // Кнопки монтируем один раз здесь; конкретные экраны только
  // переключают видимость/текст через useBackButton/useMainButton.
  safely(() => backButton.mount())
  safely(() => mainButton.mount())
  safely(() => secondaryButton.mount())

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

// Переключатель "Хаптика" в Настройках — проверяем на каждый вызов, а
// не один раз при монтировании, иначе тумблер не подействовал бы
// без перезагрузки приложения.
export const haptic = {
  tap: () => getHapticsEnabled() && safely(() => hapticFeedback.impactOccurred('light')),
  success: () => getHapticsEnabled() && safely(() => hapticFeedback.notificationOccurred('success')),
  error: () => getHapticsEnabled() && safely(() => hapticFeedback.notificationOccurred('error')),
}

/**
 * Приглашение на дуэль другу.
 *
 * ВАЖНО: для Mini App нужен именно ?startapp=, а не ?start=.
 * ?start=  -> открывает ЧАТ С БОТОМ и посылает /start duel_<id>,
 *             мини-апп при этом не открывается;
 * ?startapp=-> открывает саму мини-аппу, а значение попадает
 *             в initData.startParam.
 *
 * Основной путь — инлайн-режим бота (switchInlineQuery): друг видит
 * готовую карточку с кнопкой "Играть", без единой ссылки в тексте.
 * shareURL (обычный t.me/share/url) всегда показывает голую ссылку с
 * UUID первой строкой — многие принимают такое за спам/фишинг, даже
 * от знакомого. isAvailable() у switchInlineQuery проверяет, включён
 * ли у бота инлайн-режим (BotFather) — если нет, откатываемся на
 * старый способ, а не оставляем кнопку неработающей.
 */
export function shareDuelLink(duelId, text) {
  const bot = import.meta.env.VITE_BOT_USERNAME
  const app = import.meta.env.VITE_APP_SHORT_NAME
  const query = `duel_${duelId}`
  const url = app
    ? `https://t.me/${bot}/${app}?startapp=${query}`
    : `https://t.me/${bot}?startapp=${query}`

  if (switchInlineQuery.isAvailable()) {
    // Текст карточки собирает сам бот (tg-webhook) по реальному счёту
    // из базы — тут он ни на что не влияет, только для фолбэка ниже.
    switchInlineQuery(query, ['users'])
    return url
  }

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

/** Тот же принцип, что shareDuelLink — карточку собирает tg-webhook по compat_<uuid>. */
export function shareCompatLink(sessionId, text) {
  const bot = import.meta.env.VITE_BOT_USERNAME
  const app = import.meta.env.VITE_APP_SHORT_NAME
  const query = `compat_${sessionId}`
  const url = app
    ? `https://t.me/${bot}/${app}?startapp=${query}`
    : `https://t.me/${bot}?startapp=${query}`

  if (switchInlineQuery.isAvailable()) {
    switchInlineQuery(query, ['users'])
    return url
  }

  try {
    shareURL(url, text)
  } catch {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      '_blank',
    )
  }
  return url
}

/**
 * Публикует результат в Stories пользователя — картинка фиксированная
 * (брендинг приложения), а сам счёт идёт подписью. Ссылка на приложение
 * добавляется как виджет (виден только у Premium-подписчиков — это
 * ограничение Telegram, не наше).
 * @returns true, если попап открыт; false, если платформа не поддерживает.
 */
export function shareResultToStory(caption) {
  if (!shareStory.isAvailable()) return false

  const bot = import.meta.env.VITE_BOT_USERNAME
  const app = import.meta.env.VITE_APP_SHORT_NAME
  const url = app ? `https://t.me/${bot}/${app}` : `https://t.me/${bot}`

  shareStory(`${window.location.origin}/story-bg.png`, {
    text: caption,
    widgetLink: { url, name: 'КвизДуэль' },
  })
  return true
}

/**
 * Один раз спрашивает, добавлено ли приложение на домашний экран.
 * 'missed' -> можно предложить; 'added' -> уже есть; иначе -> не
 * поддерживается этим клиентом, лучше вообще не показывать баннер.
 */
export async function getHomeScreenStatus() {
  if (!checkHomeScreenStatus.isAvailable()) return 'unsupported'
  try {
    return await checkHomeScreenStatus()
  } catch {
    return 'unsupported'
  }
}

export function promptAddToHomeScreen() {
  if (addToHomeScreen.isAvailable()) addToHomeScreen()
}
