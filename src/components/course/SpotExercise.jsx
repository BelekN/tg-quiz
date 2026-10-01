import { useState } from 'react'
import ChatBubbles from './ChatBubbles'
import Feedback from './Feedback'
import LessonButton from './LessonButton'
import ReviewBadge from './ReviewBadge'
import { haptic } from '../../lib/telegram'

/** «Найди реплику с уловкой» — тап прямо по сообщению в переписке. */
export default function SpotExercise({ step, onResult, onNext }) {
  const [picked, setPicked] = useState(null)
  const answered = picked !== null
  const ok = picked === step.answer

  const pick = (i) => {
    if (answered) return
    const right = i === step.answer
    if (right) haptic.success()
    else haptic.error()
    setPicked(i)
    onResult(right)
  }

  const marks = !answered
    ? {}
    : ok
      ? { [step.answer]: 'right' }
      : { [picked]: 'wrong', [step.answer]: 'flag' }

  return (
    <>
      <div className="mt-6">
        <ReviewBadge show={step.is_review} />
        <p className="text-sm font-semibold text-tg-hint">👆 {step.prompt}</p>
      </div>
      <div className="mt-3">
        <ChatBubbles messages={step.messages} marks={marks} onTap={answered ? undefined : pick} />
      </div>

      {answered && <Feedback ok={ok} explain={step.explain} />}
      {answered && <LessonButton onClick={onNext}>Дальше</LessonButton>}
    </>
  )
}
