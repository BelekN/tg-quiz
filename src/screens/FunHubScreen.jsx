import Screen from '../components/Screen'
import ModeCard from '../components/ModeCard'
import { haptic } from '../lib/telegram'

/**
 * Вкладка «Для удовольствия» — хаб без очков и рейтинга. Пока внутри
 * реально работает только «Узнай себя», остальное — плашки «Скоро»
 * (тот же приём, что раньше был у Ежедневного вызова/Марафона).
 */
export default function FunHubScreen({ onPersona }) {
  return (
    <Screen className="pb-32">
      <header>
        <h1 className="text-lg font-bold">🔮 Для удовольствия</h1>
      </header>
      <p className="mt-1 text-sm text-tg-hint">
        Без очков и рейтинга — просто ради интереса
      </p>

      <div className="animate-rise mt-5 flex flex-col gap-2.5">
        <ModeCard
          icon="🔮"
          title="Узнай себя"
          subtitle="20+ тестов о тебе"
          onClick={() => {
            haptic.tap()
            onPersona()
          }}
        />
        <ModeCard
          icon="💞"
          title="Совместимость"
          subtitle="Пройдите тест вместе с другом или партнёром"
          soon
        />
        <ModeCard icon="🌟" title="Гороскоп" subtitle="Что говорят звёзды сегодня" soon />
        <ModeCard icon="🔢" title="Нумерология" subtitle="Числа, которые о тебе говорят" soon />
      </div>
    </Screen>
  )
}
