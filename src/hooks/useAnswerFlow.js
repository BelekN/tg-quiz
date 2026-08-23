import { useCallback, useRef, useState } from 'react'
import { haptic } from '../lib/telegram'

/**
 * Общий каркас "ответил -> ждём сервер -> подсветили -> дальше",
 * одинаковый в дуэли/соло/спринте. Таймеры и переход к следующему
 * вопросу (или к завершению) у них РАЗНЫЕ — это остаётся в каждом
 * экране, здесь только состояние текущего вопроса и сам submit.
 */
export function useAnswerFlow({ questions, startIndex = 0, startCorrect = 0, onError }) {
  const [index, setIndex] = useState(startIndex)
  const [phase, setPhase] = useState('answering') // answering -> sending -> reveal
  const [selected, setSelected] = useState(null)
  const [correct, setCorrect] = useState(null)
  const [correctCount, setCorrectCount] = useState(startCorrect)
  const lockedRef = useRef(false)

  const question = questions[index]
  const isLast = index === questions.length - 1

  // request: () => Promise<{ correct_option_index, is_correct }>
  const submit = useCallback(
    async (answerIndex, request) => {
      if (lockedRef.current) return
      lockedRef.current = true

      setSelected(answerIndex)
      setPhase('sending')
      haptic.tap()

      try {
        const res = await request()
        setCorrect(res.correct_option_index)
        setPhase('reveal')
        if (res.is_correct) {
          setCorrectCount((c) => c + 1)
          haptic.success()
        } else {
          haptic.error()
        }
        return res
      } catch (e) {
        // Сегодня onError всегда уводит на весь экран ошибки (см.
        // App.jsx), так что этот экран размонтируется вместе со
        // своим состоянием — но если когда-нибудь появится восстановление
        // на месте без перемонтирования, вопрос иначе навечно останется
        // заблокированным на 'sending'.
        setSelected(null)
        setPhase('answering')
        lockedRef.current = false
        onError(e)
      }
    },
    [onError],
  )

  const advance = useCallback(() => {
    setSelected(null)
    setCorrect(null)
    setPhase('answering')
    setIndex((i) => i + 1)
    lockedRef.current = false
  }, [])

  const optionState = useCallback(
    (i) => {
      if (phase === 'answering') return 'idle'
      if (phase === 'sending') return 'muted'
      if (i === correct) return 'correct'
      if (i === selected) return 'wrong'
      return 'muted'
    },
    [phase, correct, selected],
  )

  return {
    index,
    phase,
    selected,
    correct,
    correctCount,
    question,
    isLast,
    lockedRef,
    submit,
    advance,
    optionState,
  }
}
