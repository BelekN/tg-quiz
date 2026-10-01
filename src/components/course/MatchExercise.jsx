import { useState } from 'react'
import Feedback from './Feedback'
import LessonButton from './LessonButton'
import { haptic } from '../../lib/telegram'

/**
 * Сопоставление: фразы сверху, названия приёмов снизу (уже перемешаны).
 * Активна первая несопоставленная фраза — можно просто тапать названия
 * по очереди, а можно сначала выбрать другую фразу. Засчитывается как
 * верное, только если обошлось без единой ошибки.
 */
export default function MatchExercise({ step, onResult, onNext }) {
  const [matched, setMatched] = useState({}) // pairIndex -> true
  const [selected, setSelected] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [shake, setShake] = useState(null)

  const done = Object.keys(matched).length === step.pairs.length
  const usedLabels = new Set(Object.keys(matched).map((i) => step.pairs[i].label))

  const pickLabel = (label) => {
    if (done || selected === null) return
    if (step.pairs[selected].label !== label) {
      haptic.error()
      setMistakes((m) => m + 1)
      setShake(label)
      setTimeout(() => setShake(null), 350)
      return
    }
    haptic.success()
    const next = { ...matched, [selected]: true }
    setMatched(next)
    const nextFree = step.pairs.findIndex((_, i) => !next[i])
    setSelected(nextFree === -1 ? null : nextFree)
    if (nextFree === -1) onResult(mistakes === 0)
  }

  return (
    <>
      <p className="mt-6 text-sm font-semibold text-tg-hint">🧩 {step.prompt}</p>

      <div className="mt-3 flex flex-col gap-2">
        {step.pairs.map((p, i) => {
          const isMatched = matched[i]
          const isSelected = selected === i
          return (
            <button
              key={p.quote}
              type="button"
              disabled={isMatched || done}
              onClick={() => setSelected(i)}
              className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                isMatched
                  ? 'border-quiz-right/50 bg-quiz-right/10'
                  : isSelected
                    ? 'border-tg-accent bg-tg-accent/15'
                    : 'border-white/5 bg-tg-section'
              }`}
            >
              <span className="block text-[15px] leading-snug">{p.quote}</span>
              {isMatched && (
                <span className="animate-pop mt-1 block text-xs font-semibold text-quiz-right">
                  ✓ {p.label}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {!done && (
        <div className="mt-5 flex flex-wrap gap-2">
          {step.labels.map((label) =>
            usedLabels.has(label) ? null : (
              <button
                key={label}
                type="button"
                onClick={() => pickLabel(label)}
                className={`rounded-full border border-white/10 bg-tg-surface px-4 py-2.5 text-[14px] font-semibold active:scale-95 ${
                  shake === label ? 'animate-shake border-quiz-wrong text-quiz-wrong' : ''
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>
      )}

      {done && (
        <Feedback
          ok={mistakes === 0}
          title={mistakes === 0 ? '✓ Без единой ошибки!' : `Готово, ошибок: ${mistakes}`}
        />
      )}
      {done && <LessonButton onClick={onNext}>Дальше</LessonButton>}
    </>
  )
}
