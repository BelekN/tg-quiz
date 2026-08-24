import ResultCard from '../components/ResultCard'
import { haptic, shareResultToStory } from '../lib/telegram'

export default function DailyResultScreen({ result, onHome }) {
  const ratio = result.total > 0 ? result.correct / result.total : 0
  const verdict =
    ratio === 1
      ? 'Идеально! 🏆'
      : ratio >= 0.7
        ? 'Отличный результат!'
        : ratio >= 0.4
          ? 'Неплохо!'
          : 'Есть куда расти'

  const shareStory = () => {
    haptic.tap()
    shareResultToStory(
      `Прошёл сегодняшний вызов на ${result.correct}/${result.total} в КвизДуэль 📅`,
    )
  }

  return (
    <ResultCard
      icon="📅"
      title={verdict}
      subtitle="Ежедневный вызов"
      primaryStat={{
        label: 'Правильных ответов',
        value: `${result.correct}/${result.total}`,
      }}
      rows={[{ label: 'Очки', value: result.score }]}
      coinsEarned={result.coins_earned}
      secondaryAction={{ label: 'На главную', onClick: onHome }}
      tertiaryAction={{ label: '📖 Поделиться в истории', onClick: shareStory }}
      footnote={
        <p className="mt-3 text-center text-xs leading-relaxed text-tg-hint">
          Новый вызов — завтра.
        </p>
      }
    />
  )
}
