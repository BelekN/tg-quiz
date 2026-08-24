import ResultCard from '../components/ResultCard'
import { haptic, shareResultToStory } from '../lib/telegram'

export default function MarathonResultScreen({ result, onHome, onPlayAgain }) {
  const isRecord = result.correct > 0 && result.correct === result.best_streak

  const verdict =
    result.correct >= 20
      ? 'Легендарная серия! 🏆'
      : result.correct >= 10
        ? 'Отличная серия!'
        : result.correct >= 5
          ? 'Неплохая серия!'
          : 'Тренируйся дальше'

  const shareStory = () => {
    haptic.tap()
    shareResultToStory(
      `Ответил правильно на ${result.correct} вопросов подряд в Марафоне КвизДуэль ♾️`,
    )
  }

  return (
    <ResultCard
      icon="♾️"
      title={verdict}
      subtitle={isRecord ? 'Новый личный рекорд!' : `Личный рекорд: ${result.best_streak} подряд`}
      primaryStat={{ label: 'Правильных подряд', value: result.correct }}
      rows={[{ label: 'Очки', value: result.score }]}
      coinsEarned={result.coins_earned}
      primaryAction={{ label: '♾️ Ещё раз', onClick: onPlayAgain }}
      secondaryAction={{ label: 'На главную', onClick: onHome }}
      tertiaryAction={{ label: '📖 Поделиться в истории', onClick: shareStory }}
    />
  )
}
