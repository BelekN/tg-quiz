import Screen from './Screen'
import { haptic } from '../lib/telegram'

/**
 * Общий экран-приглашение перед стартом режима — показывается ДО
 * вызова стартового запроса (а не после, как в дуэли), чтобы таймер
 * сессии (Спринт) не начинал тикать, пока человек ещё читает правила.
 */
export default function ModeIntroScreen({ icon, title, description, onStart, busy }) {
  const start = () => {
    haptic.tap()
    onStart()
  }

  return (
    <Screen className="items-center justify-center text-center">
      <div className="text-6xl">{icon}</div>
      <h1 className="animate-rise mt-4 text-2xl font-bold">{title}</h1>
      <p className="mt-3 max-w-xs text-sm text-tg-hint">{description}</p>
      <button
        type="button"
        disabled={busy}
        onClick={start}
        className="mt-8 w-full max-w-xs rounded-2xl bg-tg-accent px-6 py-3.5 text-[15px] font-semibold text-tg-accent-text active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? 'Готовим вопросы…' : 'Начали!'}
      </button>
    </Screen>
  )
}
