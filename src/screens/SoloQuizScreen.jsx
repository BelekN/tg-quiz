import { useCallback, useEffect, useRef, useState } from 'react'
import Screen from '../components/Screen'
import AnswerButton from '../components/AnswerButton'
import { answerSolo } from '../lib/api'
import { categoryMeta } from '../lib/categories'
import { haptic } from '../lib/telegram'

const REVEAL_MS = 1100

/** Тот же анти-чит паттерн, что в дуэли, но без таймера и бонуса за скорость. */
export default function SoloQuizScreen({ sessionId, questions, category, onComplete, onError }) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState('answering') // answering -> sending -> reveal
  const [selected, setSelected] = useState(null)
  const [correct, setCorrect] = useState(null)
  const [correctCount, setCorrectCount] = useState(0)

  const question = questions[index]
  const isLast = index === questions.length - 1
  const lockedRef = useRef(false)
  const meta = categoryMeta(category)

  const submit = useCallback(
    async (answerIndex) => {
      if (lockedRef.current) return
      lockedRef.current = true

      setSelected(answerIndex)
      setPhase('sending')
      haptic.tap()

      try {
        const res = await answerSolo(sessionId, index, answerIndex)
        setCorrect(res.correct_option_index)
        setPhase('reveal')
        if (res.is_correct) {
          setCorrectCount((c) => c + 1)
          haptic.success()
        } else {
          haptic.error()
        }
      } catch (e) {
        onError(e.message)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, index],
  )

  useEffect(() => {
    if (phase !== 'reveal') return

    const t = setTimeout(() => {
      if (isLast) {
        onComplete()
        return
      }
      setSelected(null)
      setCorrect(null)
      setPhase('answering')
      setIndex((i) => i + 1)
      lockedRef.current = false
    }, REVEAL_MS)

    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isLast])

  const optionState = (i) => {
    if (phase === 'answering') return 'idle'
    if (phase === 'sending') return 'muted'
    if (i === correct) return 'correct'
    if (i === selected) return 'wrong'
    return 'muted'
  }

  return (
    <Screen>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-tg-hint">
          {meta.icon} {meta.label}
          <span className="text-tg-hint/60">
            {' '}
            · {index + 1}/{questions.length}
          </span>
        </span>
        <span className="text-sm font-semibold text-quiz-right tabular-nums">
          ✓ {correctCount}
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
            disabled={phase !== 'answering'}
            onClick={() => submit(i)}
          />
        ))}
      </div>

      {phase !== 'answering' && (
        <p className="mt-5 text-center text-sm text-tg-hint">
          {phase === 'sending'
            ? 'Проверяем…'
            : selected === correct
              ? 'Верно!'
              : 'Мимо'}
        </p>
      )}
    </Screen>
  )
}
