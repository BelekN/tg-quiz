import { useCallback, useEffect, useRef, useState } from 'react'
import Screen from '../components/Screen'
import TimerBar from '../components/TimerBar'
import AnswerButton from '../components/AnswerButton'
import { useCountdown } from '../hooks/useCountdown'
import { useAnswerFlow } from '../hooks/useAnswerFlow'
import { answerSprint } from '../lib/api'

const DURATION_MS = 60_000
const REVEAL_MS = 500

/**
 * Общий таймер на всю сессию (не на вопрос, как в дуэли).
 * Если время истекает во время отправки/показа текущего ответа —
 * достраиваем этот ответ и завершаем сразу после, а не обрываем его.
 */
export default function SprintScreen({ sessionId, questions, onComplete, onError }) {
  // "done" — сессия закрыта (по таймеру или по последнему вопросу).
  // Отдельно от phase из useAnswerFlow: тому не нужно знать про сессию
  // целиком, только про текущий вопрос.
  const [done, setDone] = useState(false)
  const timeUpRef = useRef(false)
  const finishedRef = useRef(false)

  const finishNow = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    onComplete()
  }, [onComplete])

  // Сервер — источник истины по времени, свой таймер у него строже
  // клиентского: если тап приходится ровно на границу истечения 60с,
  // ответ может уйти чуть раньше, чем клиентский onExpire успеет
  // выставить timeUpRef, и сервер честно отклонит его SPRINT_TIME_UP.
  // Это не поломка — тот же самый "время вышло", просто узнали о нём
  // из ответа сервера, а не из своего таймера. Показывать как обычную
  // ошибку незачем — просто завершаем сессию, как при обычном таймауте.
  const handleAnswerError = useCallback(
    (e) => {
      if (e.message === 'SPRINT_TIME_UP') {
        timeUpRef.current = true
        setDone(true)
        finishNow()
        return
      }
      onError(e)
    },
    [onError, finishNow],
  )

  const {
    index,
    phase,
    correctCount,
    question,
    submit,
    advance,
    optionState,
  } = useAnswerFlow({ questions, onError: handleAnswerError })

  const submitAnswer = (answerIndex) => {
    if (timeUpRef.current) return
    submit(answerIndex, () => answerSprint(sessionId, index, answerIndex))
  }

  // общий таймер на 60 секунд, не сбрасывается между вопросами.
  // phaseRef нужен, т.к. onExpire захватывается один раз при монтировании.
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const { remaining } = useCountdown(DURATION_MS, sessionId, !done, () => {
    timeUpRef.current = true
    // если сейчас идёт отправка/показ ответа — дожидаемся его завершения
    // (эффект на reveal ниже сам увидит timeUpRef и закроет сессию)
    if (phaseRef.current === 'answering') {
      setDone(true)
      finishNow()
    }
  })

  useEffect(() => {
    if (phase !== 'reveal') return

    const t = setTimeout(() => {
      const isLast = index + 1 >= questions.length
      if (timeUpRef.current || isLast) {
        setDone(true)
        finishNow()
        return
      }
      advance()
    }, REVEAL_MS)

    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index, questions.length])

  return (
    <Screen>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-tg-hint">
          ⚡ Спринт
        </span>
        <span className="text-sm font-semibold text-quiz-right tabular-nums">
          ✓ {correctCount}
        </span>
      </div>

      <div className="mt-5">
        <TimerBar remaining={remaining} duration={DURATION_MS} />
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
    </Screen>
  )
}
