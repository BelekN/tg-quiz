import { useEffect } from 'react'
import Screen from '../components/Screen'
import AnswerButton from '../components/AnswerButton'
import { useAnswerFlow } from '../hooks/useAnswerFlow'
import { answerSolo } from '../lib/api'
import { categoryMeta } from '../lib/categories'

const REVEAL_MS = 1100

/** Тот же анти-чит паттерн, что в дуэли, но без таймера и бонуса за скорость. */
export default function SoloQuizScreen({ sessionId, questions, category, onComplete, onError }) {
  const {
    index,
    phase,
    selected,
    correct,
    correctCount,
    question,
    isLast,
    submit,
    advance,
    optionState,
  } = useAnswerFlow({ questions, onError })

  const meta = categoryMeta(category)

  const submitAnswer = (answerIndex) =>
    submit(answerIndex, () => answerSolo(sessionId, index, answerIndex))

  useEffect(() => {
    if (phase !== 'reveal') return

    const t = setTimeout(() => {
      if (isLast) {
        onComplete()
        return
      }
      advance()
    }, REVEAL_MS)

    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isLast])

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
            onClick={() => submitAnswer(i)}
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
