import ResultCard from '../components/ResultCard'

export default function SprintResultScreen({ result, onHome, onPlayAgain }) {
  const verdict =
    result.correct >= 20
      ? 'Огонь! 🔥'
      : result.correct >= 12
        ? 'Отличный темп!'
        : result.correct >= 6
          ? 'Неплохо!'
          : 'Разгоняйся дальше'

  return (
    <ResultCard
      icon="⚡"
      title={verdict}
      subtitle="60 секунд позади"
      primaryStat={{ label: 'Правильных ответов', value: result.correct }}
      rows={[{ label: 'Очки', value: result.score }]}
      coinsEarned={result.coins_earned}
      primaryAction={{ label: '⚡ Ещё раз', onClick: onPlayAgain }}
      secondaryAction={{ label: 'На главную', onClick: onHome }}
    />
  )
}
