import Screen from '../components/Screen'
import { useMainButton, useSecondaryButton } from '../hooks/useBottomButton'
import { haptic, shareResultToStory } from '../lib/telegram'

/**
 * Нет ни очков, ни монет — карточка результата теста из раздела "Узнай себя",
 * заточенная под шеринг в Stories, а не под игровую статистику.
 */
export default function PersonaResultScreen({ testTitle, result, onHome, onPlayAgain }) {
  const shareStory = () => {
    haptic.tap()
    shareResultToStory(`Прошёл тест «${testTitle}» — я ${result.title} ${result.icon}`)
  }

  useMainButton({ text: '🔮 Другой тест', onClick: onPlayAgain })
  useSecondaryButton({ text: 'На главную', onClick: onHome })

  return (
    <Screen className="justify-center">
      <div className="animate-pop text-center">
        <div className="text-6xl">{result.icon}</div>
        <p className="mt-3 text-xs uppercase tracking-wider text-tg-hint">{testTitle}</p>
        <h1 className="mt-1 text-2xl font-bold">{result.title}</h1>
      </div>

      <div className="animate-rise mt-7 rounded-3xl border border-white/5 bg-tg-section p-5">
        <p className="text-center text-[15px] leading-relaxed text-tg-text">
          {result.description}
        </p>
      </div>

      <button
        type="button"
        onClick={shareStory}
        className="mt-5 text-center text-sm font-medium text-tg-link active:opacity-70"
      >
        📖 Поделиться в истории
      </button>
    </Screen>
  )
}
