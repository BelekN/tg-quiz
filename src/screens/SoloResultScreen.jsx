import ResultCard from '../components/ResultCard'
import { categoryMeta } from '../lib/categories'

export default function SoloResultScreen({ result, onHome, onPlayAgain }) {
  const meta = categoryMeta(result.category)
  const ratio = result.total > 0 ? result.correct / result.total : 0
  const verdict =
    ratio === 1
      ? 'Идеально! 🏆'
      : ratio >= 0.7
        ? 'Отличный результат!'
        : ratio >= 0.4
          ? 'Неплохо!'
          : 'Есть куда расти'

  return (
    <ResultCard
      icon={meta.icon}
      title={verdict}
      subtitle={meta.label}
      primaryStat={{
        label: 'Правильных ответов',
        value: `${result.correct}/${result.total}`,
      }}
      rows={[{ label: 'Очки', value: result.score }]}
      coinsEarned={result.coins_earned}
      primaryAction={{ label: '🔁 Другая тема', onClick: onPlayAgain }}
      secondaryAction={{ label: 'На главную', onClick: onHome }}
    />
  )
}
