import Screen from '../components/Screen'
import { t } from '../lib/i18n'

/**
 * Блокирующий экран: сервер сказал, что текущая версия ниже
 * MIN_APP_VERSION (см. tg-api "me"). Без кнопки "назад" — это не
 * ошибка, из которой можно вернуться, а тупик до обновления.
 */
export default function ForceUpdateScreen() {
  return (
    <Screen className="items-center justify-center text-center">
      <div className="text-6xl">🚀</div>
      <h1 className="animate-rise mt-4 text-2xl font-bold">{t('forceUpdate.title')}</h1>
      <p className="mt-3 max-w-xs text-sm text-tg-hint">{t('forceUpdate.body')}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-8 w-full max-w-xs rounded-2xl bg-tg-accent px-6 py-3.5 text-[15px] font-semibold text-tg-accent-text active:scale-[0.98]"
      >
        {t('forceUpdate.button')}
      </button>
    </Screen>
  )
}
