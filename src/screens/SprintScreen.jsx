import { useCallback, useEffect, useRef, useState } from 'react'
import Screen from '../components/Screen'
import TimerBar from '../components/TimerBar'
import AnswerButton from '../components/AnswerButton'
import { useCountdown } from '../hooks/useCountdown'
import { answerSprint } from '../lib/api'
import { haptic } from '../lib/telegram'

const DURATION_MS = 60_000
const REVEAL_MS = 500

/**
 * Общий таймер на всю сессию (не на вопрос, как в дуэли).
 * Если время истекает во время отправки/показа текущего ответа —
 * достраиваем этот ответ и завершаем сразу после, а не обрываем его.
 */
export default function SprintScreen({ sessionId, questions, onComplete, onError }) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState('answering') // answering -> sending -> reveal
  const [selected, setSelected] = useState(null)
  const [correct, setCorrect] = useState(null)
  const [correctCount, setCorrectCount] = useState(0)

  const question = questions[index]
  const lockedRef = useRef(false)
  const timeUpRef = useRef(false)
  const finishedRef = useRef(false)

  const finishNow = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    onComplete()
  }, [onComplete])

  const submit = useCallback(
    async (answerIndex) => {
      if (lockedRef.current || timeUpRef.current) return
      lockedRef.current = true

      setSelected(answerIndex)
      setPhase('sending')
      haptic.tap()

      try {
        const res = await answerSprint(sessionId, index, answerIndex)
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

  // общий таймер на 60 секунд, не сбрасывается между вопросами.
  // phaseRef нужен, т.к. onExpire захватывается один раз при монтировании.
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const { remaining } = useCountdown(DURATION_MS, sessionId, phase !== 'done', () => {
    timeUpRef.current = true
    // если сейчас идёт отправка/показ ответа — дожидаемся его завершения
    // (эффект на reveal ниже сам увидит timeUpRef и закроет сессию)
    if (phaseRef.current === 'answering') {
      setPhase('done')
      finishNow()
    }
  })

  useEffect(() => {
    if (phase !== 'reveal') return

    const t = setTimeout(() => {
      const isLast = index + 1 >= questions.length
      if (timeUpRef.current || isLast) {
        setPhase('done')
        finishNow()
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
  }, [phase, index, questions.length])

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
            onClick={() => submit(i)}
          />
        ))}
      </div>
    </Screen>
  )
}
