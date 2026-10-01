import { useState } from 'react'
import Quote from './Quote'
import Feedback from './Feedback'
import LessonButton from './LessonButton'
import ReviewBadge from './ReviewBadge'
import { haptic } from '../../lib/telegram'

/** «Честно или уловка?» — самое быстрое упражнение, на один тап. Подписи — из ui курса. */
export default function BinaryExercise({ step, ui, onResult, onNext }) {
  const choices = [
    { trick: false, label: ui.binary_honest },
    { trick: true, label: ui.binary_trick },
  ]
  const [picked, setPicked] = useState(null)
  const answered = picked !== null
  const ok = answered && picked === step.trick

  const pick = (trick) => {
    if (answered) return
    const right = trick === step.trick
    if (right) haptic.success()
    else haptic.error()
    setPicked(trick)
    onResult(right)
  }

  return (
    <>
      <div className="mt-6">
        <ReviewBadge show={step.is_review} />
        <p className="text-sm font-semibold text-tg-hint">{ui.binary_prompt}</p>
      </div>
      <div className="animate-rise mt-3">
        <Quote>{step.quote}</Quote>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {choices.map((c) => {
          const isPicked = picked === c.trick
          const isRight = c.trick === step.trick
          const skin = !answered
            ? 'bg-tg-surface border-white/5 active:scale-[0.97]'
            : isRight
              ? 'bg-quiz-right/20 border-quiz-right text-quiz-right'
              : isPicked
                ? 'bg-quiz-wrong/20 border-quiz-wrong text-quiz-wrong animate-shake'
                : 'bg-tg-surface/50 border-transparent text-tg-hint'
          return (
            <button
              key={c.label}
              type="button"
              disabled={answered}
              onClick={() => pick(c.trick)}
              className={`rounded-2xl border px-3 py-4 text-[15px] font-semibold transition-all ${skin}`}
            >
              {c.label}
            </button>
          )
        })}
      </div>

      {answered && <Feedback ok={ok} explain={step.explain} />}
      {answered && <LessonButton onClick={onNext}>Дальше</LessonButton>}
    </>
  )
}
