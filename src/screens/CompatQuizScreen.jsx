import { useState } from 'react'
import Screen from '../components/Screen'
import AnswerButton from '../components/AnswerButton'
import { haptic } from '../lib/telegram'
import { answerCompat } from '../lib/api'

const ADVANCE_MS = 400

/**
 * Как PersonaQuizScreen, но каждый ответ реально уходит на сервер
 * (answer_compat) — партнёру нужно сравнить именно записанные ответы,
 * а не то, что клиент насчитал сам. Нет ни правильных ответов, ни
 * таймера — можно отвечать в своём темпе.
 */
export default function CompatQuizScreen({ sessionId, title, questions, onComplete, onError }) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)

  const question = questions[index]
  const isLast = index === questions.length - 1

  const pick = async (i) => {
    if (selected !== null || busy) return
    haptic.tap()
    setSelected(i)
    setBusy(true)
    try {
      const res = await answerCompat(sessionId, question.id, i)
      setTimeout(() => {
        if (isLast || res.my_answered >= res.total) {
          onComplete(res)
          return
        }
        setIndex((idx) => idx + 1)
        setSelected(null)
        setBusy(false)
      }, ADVANCE_MS)
    } catch (e) {
      setBusy(false)
      setSelected(null)
      onError(e)
    }
  }

  const optionState = (i) => {
    if (selected === null) return 'idle'
    return i === selected ? 'correct' : 'muted'
  }

  return (
    <Screen>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-tg-hint">
          💞 {title}
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
            text={opt}
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
