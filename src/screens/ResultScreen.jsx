import { useEffect, useState } from 'react'
import ResultCard from '../components/ResultCard'
import { fetchDuelProgress } from '../lib/api'
import { haptic, shareDuelLink, shareResultToStory } from '../lib/telegram'

const OUTCOME = {
  win: { emoji: '🏆', title: 'Победа!', color: 'text-quiz-gold' },
  lose: { emoji: '💔', title: 'Поражение', color: 'text-quiz-wrong' },
  draw: { emoji: '🤝', title: 'Ничья', color: 'text-tg-text' },
  pending: { emoji: '⏳', title: 'Ждём соперника', color: 'text-tg-accent' },
}

const POLL_MS = 4000

export default function ResultScreen({ result, role, onHome, onRematch, onOpponentFinished }) {
  const [shared, setShared] = useState(false)
  const view = OUTCOME[result.outcome] ?? OUTCOME.pending

  // Пока ждём соперника — поллим вместо того, чтобы заставлять
  // человека самому выходить и заходить обратно, чтобы узнать исход.
  useEffect(() => {
    if (result.outcome !== 'pending' || !result.duel_id) return
    let alive = true

    const tick = () => {
      fetchDuelProgress(result.duel_id)
        .then((progress) => {
          if (alive && progress.opponent_finished) onOpponentFinished(progress)
        })
        .catch(() => {}) // сеть моргнула — попробуем на следующем тике
    }
    const id = setInterval(tick, POLL_MS)

    return () => {
      alive = false
      clearInterval(id)
    }
  }, [result.outcome, result.duel_id, onOpponentFinished])
  // Приглашать есть смысл только хосту и только пока дуэль открыта
  const canInvite = role === 'host' && result.outcome === 'pending'
  // Реванш — когда известны оба счёта и оба участника, независимо от роли
  const canRematch = result.outcome !== 'pending'

  const invite = () => {
    haptic.tap()
    shareDuelLink(
      result.duel_id,
      `Я набрал ${result.score} очков в дуэли. Побьёшь? ⚔️`,
    )
    setShared(true)
  }

  const rematch = () => {
    haptic.tap()
    onRematch()
  }

  const shareStory = () => {
    haptic.tap()
    shareResultToStory(`Набрал ${result.score} очков в дуэли КвизДуэль ⚔️`)
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
          : canRematch
            ? { label: '🔁 Реванш', onClick: rematch }
            : null
      }
      secondaryAction={{ label: 'На главную', onClick: onHome }}
      tertiaryAction={{ label: '📖 Поделиться в истории', onClick: shareStory }}
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
