import { useState } from 'react'
import AnswerButton from '../AnswerButton'
import Quote from './Quote'
import Feedback from './Feedback'
import LessonButton from './LessonButton'
import ReviewBadge from './ReviewBadge'
import { haptic } from '../../lib/telegram'

/** «Какая это уловка?» — цитата + варианты (уже перемешаны в lib/course.js). */
export default function ChoiceExercise({ step, onResult, onNext }) {
  const [picked, setPicked] = useState(null)
  const answered = picked !== null

  const pick = (i) => {
    if (answered) return
    const right = i === step.answer
    if (right) haptic.success()
    else haptic.error()
    setPicked(i)
    onResult(right)
  }

  const state = (i) => {
    if (!answered) return 'idle'
    if (i === step.answer) return 'correct'
    return i === picked ? 'wrong' : 'muted'
  }

  return (
    <>
      <div className="mt-6">
        <ReviewBadge show={step.is_review} />
        <p className="text-sm font-semibold text-tg-hint">{step.prompt}</p>
      </div>
      {step.quote && (
        <div className="animate-rise mt-3">
          <Quote>{step.quote}</Quote>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2.5">
        {step.options.map((opt, i) => (
          <AnswerButton
            key={opt}
            text={opt}
            index={i}
            state={state(i)}
            disabled={answered}
            onClick={() => pick(i)}
          />
        ))}
      </div>

      {answered && <Feedback ok={picked === step.answer} explain={step.explain} />}
      {answered && <LessonButton onClick={onNext}>Дальше</LessonButton>}
    </>
  )
}
