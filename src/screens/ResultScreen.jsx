import { useState } from 'react'
import Screen from '../components/Screen'
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
    <Screen className="justify-center">
      <div className="animate-pop text-center">
        <div className="text-6xl">{view.emoji}</div>
        <h1 className={`mt-3 text-2xl font-bold ${view.color}`}>
          {view.title}
        </h1>
        <p className="mt-1 text-sm text-tg-hint">
          {result.correct} из {result.total} правильно
        </p>
      </div>

      {/* ---- очки ---- */}
      <div className="animate-rise mt-7 rounded-3xl border border-white/5 bg-tg-section p-5">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-wider text-tg-hint">
            Ваш результат
          </p>
          <p className="text-4xl font-bold tabular-nums">{result.score}</p>
        </div>

        {result.opponent_score !== null &&
          result.opponent_score !== undefined && (
            <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4 text-sm">
              <span className="text-tg-hint">Соперник</span>
              <span className="font-semibold tabular-nums">
                {result.opponent_score}
              </span>
            </div>
          )}

        <div className="mt-3 flex items-center justify-between rounded-xl bg-quiz-gold/10 px-3 py-2.5">
          <span className="text-sm text-tg-hint">Начислено монет</span>
          <span className="font-bold text-quiz-gold tabular-nums">
            +{result.coins_earned}
          </span>
        </div>
      </div>

      {/* ---- действия ---- */}
      <div className="mt-6 flex flex-col gap-2.5">
        {canInvite && (
          <button
            type="button"
            onClick={invite}
            className="w-full rounded-2xl bg-tg-accent px-5 py-4 text-[16px] font-semibold text-tg-accent-text shadow-lg shadow-tg-accent/20 transition-transform active:scale-[0.98]"
          >
            {shared ? '↗️  Отправить ещё раз' : '🎯  Вызвать друга в Telegram'}
          </button>
        )}

        <button
          type="button"
          onClick={onHome}
          className="w-full rounded-2xl bg-tg-surface px-5 py-4 text-[15px] font-medium text-tg-text transition-transform active:scale-[0.98]"
        >
          На главную
        </button>
      </div>

      {canInvite && (
        <p className="mt-3 text-center text-xs leading-relaxed text-tg-hint">
          Друг откроет ссылку, ответит на те же 5 вопросов —
          <br />
          и вы оба увидите итог дуэли.
        </p>
      )}
    </Screen>
  )
}
