import { useMemo, useRef, useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import TextStep from '../components/course/TextStep'
import ChatStep from '../components/course/ChatStep'
import ConceptStep from '../components/course/ConceptStep'
import BinaryExercise from '../components/course/BinaryExercise'
import ChoiceExercise from '../components/course/ChoiceExercise'
import SpotExercise from '../components/course/SpotExercise'
import MatchExercise from '../components/course/MatchExercise'
import RatingStep from '../components/course/RatingStep'
import ExamStep from '../components/course/ExamStep'
import { PHASE_LABELS, buildLessonSteps, isExercise } from '../lib/course'

const EXERCISES = {
  binary: BinaryExercise,
  choice: ChoiceExercise,
  spot: SpotExercise,
  match: MatchExercise,
}

/**
 * Один день курса — лента шагов: теория (A) → закрепление (B) → оценка
 * карточек, а на последнем дне — итоговый тест (C). Ответы практики
 * проверяются тут же (приходят вместе с днём), на сервер уходит только
 * итог: сколько верно, оценки карточек или ответы теста.
 */
export default function CourseLessonScreen({ lesson, examOnly, onComplete, onExit }) {
  const steps = useMemo(() => buildLessonSteps(lesson, { examOnly }), [lesson, examOnly])
  const [index, setIndex] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const scoreRef = useRef({ correct: 0, total: 0 })

  const step = steps[index]
  const next = () => setIndex((i) => Math.min(i + 1, steps.length - 1))

  const cardTitles = useMemo(() => {
    const map = {}
    for (const c of [...(lesson.new_cards ?? []), ...(lesson.review_cards ?? [])]) map[c.key] = c.title
    return map
  }, [lesson])

  const onResult = (ok) => {
    scoreRef.current.total += 1
    if (ok) scoreRef.current.correct += 1
  }

  const finish = (extra) => {
    if (submitted) return
    setSubmitted(true)
    onComplete({ ...scoreRef.current, ...extra })
  }

  // День без единого шага после теории (такого контента нет, но на
  // случай пустой practice) — завершаем с последнего шага теории.
  const isLastStep = index === steps.length - 1
  const theoryNext = isLastStep && !isExercise(step) ? () => finish({}) : next

  let body
  if (step.type === 'intro' || step.type === 'tip') {
    body = <TextStep step={step} onNext={theoryNext} />
  } else if (step.type === 'chat') {
    body = <ChatStep step={step} cardTitle={cardTitles[step.card]} onNext={theoryNext} />
  } else if (step.type === 'concept') {
    body = <ConceptStep step={step} onNext={theoryNext} />
  } else if (EXERCISES[step.type]) {
    const Exercise = EXERCISES[step.type]
    body = (
      <Exercise
        step={step}
        onResult={onResult}
        onNext={isLastStep ? () => finish({}) : next}
      />
    )
  } else if (step.type === 'rating') {
    body = <RatingStep step={step} busy={submitted} onDone={(ratings) => finish({ ratings })} />
  } else if (step.type === 'exam') {
    body = (
      <ExamStep step={step} busy={submitted} onDone={(examAnswers) => finish({ examAnswers })} />
    )
  }

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onExit} />
        <div className="flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
            День {lesson.day} из {lesson.total_days} · {PHASE_LABELS[step.phase]}
          </p>
          <p className="text-[15px] font-semibold leading-tight">{lesson.title}</p>
        </div>
      </header>

      <div className="mt-3 flex gap-1">
        {steps.map((s, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i < index
                ? s.phase === 'A'
                  ? 'bg-tg-accent'
                  : s.phase === 'B'
                    ? 'bg-quiz-right'
                    : 'bg-quiz-gold'
                : i === index
                  ? 'bg-white/40'
                  : 'bg-white/8'
            }`}
          />
        ))}
      </div>

      {/* key — чтобы состояние шага (выбранный ответ и т.п.) не
          перетекало в следующий шаг того же типа */}
      <div key={index} className="flex flex-1 flex-col">
        {body}
      </div>
    </Screen>
  )
}
