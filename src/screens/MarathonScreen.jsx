import { useEffect } from 'react'
import Screen from '../components/Screen'
import AnswerButton from '../components/AnswerButton'
import { useAnswerFlow } from '../hooks/useAnswerFlow'
import { answerMarathon } from '../lib/api'

const REVEAL_MS = 900

/**
 * Как Спринт, но без общего таймера: вопросы идут, пока не ошибёшься
 * (или не кончится пул сессии). Обрыв серии определяем на клиенте по
 * selected !== correct — сам факт истинности уже проверил и записал
 * сервер в answer_marathon.
 */
export default function MarathonScreen({ sessionId, questions, onComplete, onError }) {
  const {
    index,
    phase,
    selected,
    correct,
    correctCount,
    question,
    submit,
    advance,
    optionState,
  } = useAnswerFlow({ questions, onError })

  const submitAnswer = (answerIndex) =>
    submit(answerIndex, () => answerMarathon(sessionId, index, answerIndex))

  useEffect(() => {
    if (phase !== 'reveal') return

    const wrong = selected !== correct
    const poolExhausted = index + 1 >= questions.length

    const t = setTimeout(() => {
      if (wrong || poolExhausted) {
        onComplete()
        return
      }
      advance()
    }, REVEAL_MS)

    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index, selected, correct, questions.length])

  return (
    <Screen>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-tg-hint">♾️ Марафон</span>
        <span className="text-sm font-semibold text-quiz-right tabular-nums">
          🔥 {correctCount}
        </span>
      </div>

      <div key={question.id} className="animate-rise mt-7 mb-6">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-tg-accent">
          {question.category}
        </p>
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

      {phase === 'reveal' && (
        <p className="mt-5 text-center text-sm text-tg-hint">
          {selected === correct ? 'Верно! Дальше…' : 'Серия закончилась'}
        </p>
      )}
    </Screen>
  )
}
