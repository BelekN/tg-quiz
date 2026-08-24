import Screen from '../components/Screen'
import { haptic } from '../lib/telegram'

/**
 * Экран-приглашение перед первым вопросом. Раньше гость по ссылке
 * проваливался прямо в вопрос с таймером, не понимая правил — теперь
 * и хост, и гость сначала видят формат игры и жмут "Начали!" сами.
 */
export default function DuelIntroScreen({ role, onStart }) {
  const start = () => {
    haptic.tap()
    onStart()
  }

  return (
    <Screen className="items-center justify-center text-center">
      <div className="text-6xl">⚔️</div>
      <h1 className="animate-rise mt-4 text-2xl font-bold">
        {role === 'guest' ? 'Тебя вызвали на дуэль!' : 'Дуэль создана!'}
      </h1>
      <p className="mt-3 max-w-xs text-sm text-tg-hint">
        5 вопросов, 10 секунд на каждый. Больше правильных и быстрых
        ответов — победа.
      </p>
      <button
        type="button"
        onClick={start}
        className="mt-8 w-full max-w-xs rounded-2xl bg-tg-accent px-6 py-3.5 text-[15px] font-semibold text-tg-accent-text active:scale-[0.98]"
      >
        Начали! ⚔️
      </button>
    </Screen>
  )
}
