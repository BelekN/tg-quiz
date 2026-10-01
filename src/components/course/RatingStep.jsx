import { useState } from 'react'
import LessonButton from './LessonButton'
import { RATINGS } from '../../lib/course'
import { haptic } from '../../lib/telegram'

/**
 * Самооценка по каждой карточке дня — от неё зависит, когда карточка
 * вернётся в повторение (см. complete_course_day: Лейтнер на сервере).
 */
export default function RatingStep({ step, busy, onDone }) {
  const [ratings, setRatings] = useState({})
  const allRated = step.cards.every((c) => ratings[c.key])

  return (
    <>
      <div className="animate-rise mt-6">
        <h1 className="text-[20px] font-bold">Как запомнилось?</h1>
        <p className="mt-1 text-sm text-tg-hint">
          Честно — от этого зависит, когда тема вернётся в повторение
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {step.cards.map((card) => (
          <div key={card.key} className="animate-rise rounded-2xl bg-tg-section p-3.5">
            <p className="text-[15px] font-semibold">
              {card.icon} {card.title}
            </p>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {RATINGS.map((r) => {
                const active = ratings[card.key] === r.key
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => {
                      haptic.tap()
                      setRatings((s) => ({ ...s, [card.key]: r.key }))
                    }}
                    className={`flex flex-col items-center gap-0.5 rounded-xl border py-2 text-xs font-semibold transition-all active:scale-95 ${
                      active
                        ? 'border-tg-accent bg-tg-accent/20 text-tg-text'
                        : 'border-white/5 bg-tg-surface text-tg-hint'
                    }`}
                  >
                    <span className="text-xl">{r.icon}</span>
                    {r.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <LessonButton disabled={!allRated || busy} onClick={() => onDone(ratings)}>
        {busy ? 'Сохраняем…' : 'Завершить день'}
      </LessonButton>
    </>
  )
}
