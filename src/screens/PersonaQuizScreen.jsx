import { useRef, useState } from 'react'
import Screen from '../components/Screen'
import AnswerButton from '../components/AnswerButton'
import { haptic } from '../lib/telegram'

const ADVANCE_MS = 350

/**
 * В отличие от дуэли/соло/спринта тут нет правильного ответа и нет
 * запроса на сервер за каждый вопрос — ответы просто копятся локально
 * (см. lib/persona.js), и по ним на последнем вопросе считается итог.
 */
export default function PersonaQuizScreen({ title, questions, onComplete }) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const answersRef = useRef([])

  const question = questions[index]
  const isLast = index === questions.length - 1

  const pick = (i) => {
    if (selected !== null) return
    haptic.tap()
    setSelected(i)
    answersRef.current[index] = question.options[i]

    setTimeout(() => {
      if (isLast) {
        onComplete(answersRef.current)
        return
      }
      setIndex((idx) => idx + 1)
      setSelected(null)
    }, ADVANCE_MS)
  }

  const optionState = (i) => {
    if (selected === null) return 'idle'
    return i === selected ? 'correct' : 'muted'
  }

  return (
    <Screen>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-tg-hint">
          🔮 {title}
          <span className="text-tg-hint/60">
            {' '}
            · {index + 1}/{questions.length}
          </span>
        </span>
      </div>

      <div className="mt-3 flex gap-1.5">
        {questions.map((q, i) => (
          <span
            key={q.id}
            className={`h-1 flex-1 rounded-full ${
              i < index ? 'bg-tg-accent' : i === index ? 'bg-tg-accent/50' : 'bg-white/8'
            }`}
          />
        ))}
      </div>

      <div key={question.id} className="animate-rise mt-7 mb-6">
        <h1 className="text-[22px] font-bold leading-snug">{question.question}</h1>
      </div>

      <div className="flex flex-col gap-2.5">
        {question.options.map((opt, i) => (
          <AnswerButton
            key={i}
            text={opt.label}
            index={i}
            state={optionState(i)}
            disabled={selected !== null}
            onClick={() => pick(i)}
          />
        ))}
      </div>
    </Screen>
  )
}
