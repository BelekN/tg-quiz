import { useState } from 'react'
import ResultCard from '../components/ResultCard'
import { haptic, shareDuelLink } from '../lib/telegram'

const OUTCOME = {
  win: { emoji: '🏆', title: 'Победа!', color: 'text-quiz-gold' },
  lose: { emoji: '💔', title: 'Поражение', color: 'text-quiz-wrong' },
  draw: { emoji: '🤝', title: 'Ничья', color: 'text-tg-text' },
  pending: { emoji: '⏳', title: 'Ждём соперника', color: 'text-tg-accent' },
}

export default function ResultScreen({ result, role, onHome }) {
  const [shared, setShared] = useState(false)
  const view = OUTCOME[result.outcome] ?? OUTCOME.pending
  // Приглашать есть смысл только хосту и только пока дуэль открыта
  const canInvite = role === 'host' && result.outcome === 'pending'

  const invite = () => {
    haptic.tap()
    shareDuelLink(
      result.duel_id,
      `Я набрал ${result.score} очков в дуэли. Побьёшь? ⚔️`,
    )
    setShared(true)
  }

  return (
    <ResultCard
      icon={view.emoji}
      title={view.title}
      titleColor={view.color}
      subtitle={`${result.correct} из ${result.total} правильно`}
      primaryStat={{ label: 'Ваш результат', value: result.score }}
      rows={
        result.opponent_score !== null && result.opponent_score !== undefined
          ? [{ label: 'Соперник', value: result.opponent_score }]
          : []
      }
      coinsEarned={result.coins_earned}
      primaryAction={
        canInvite
          ? {
              label: shared ? '↗️  Отправить ещё раз' : '🎯  Вызвать друга в Telegram',
              onClick: invite,
            }
          : null
      }
      secondaryAction={{ label: 'На главную', onClick: onHome }}
      footnote={
        canInvite && (
          <p className="mt-3 text-center text-xs leading-relaxed text-tg-hint">
            Друг откроет ссылку, ответит на те же 5 вопросов —
            <br />
            и вы оба увидите итог дуэли.
          </p>
        )
      }
    />
  )
}
