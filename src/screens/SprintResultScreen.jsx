import Screen from '../components/Screen'

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
    <Screen className="justify-center">
      <div className="animate-pop text-center">
        <div className="text-6xl">⚡</div>
        <h1 className="mt-3 text-2xl font-bold">{verdict}</h1>
        <p className="mt-1 text-sm text-tg-hint">60 секунд позади</p>
      </div>

      <div className="animate-rise mt-7 rounded-3xl border border-white/5 bg-tg-section p-5">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-wider text-tg-hint">
            Правильных ответов
          </p>
          <p className="text-4xl font-bold tabular-nums">{result.correct}</p>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4 text-sm">
          <span className="text-tg-hint">Очки</span>
          <span className="font-semibold tabular-nums">{result.score}</span>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-quiz-gold/10 px-3 py-2.5">
          <span className="text-sm text-tg-hint">Начислено монет</span>
          <span className="font-bold text-quiz-gold tabular-nums">
            +{result.coins_earned}
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onPlayAgain}
          className="w-full rounded-2xl bg-tg-accent px-5 py-4 text-[16px] font-semibold text-tg-accent-text shadow-lg shadow-tg-accent/20 transition-transform active:scale-[0.98]"
        >
          ⚡ Ещё раз
        </button>
        <button
          type="button"
          onClick={onHome}
          className="w-full rounded-2xl bg-tg-surface px-5 py-4 text-[15px] font-medium text-tg-text transition-transform active:scale-[0.98]"
        >
          На главную
        </button>
      </div>
    </Screen>
  )
}
