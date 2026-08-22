import { useCallback, useEffect, useRef, useState } from 'react'
import Screen from '../components/Screen'
import TimerBar from '../components/TimerBar'
import AnswerButton from '../components/AnswerButton'
import { useCountdown } from '../hooks/useCountdown'
import { answerQuestion } from '../lib/api'
import { haptic } from '../lib/telegram'

const QUESTION_MS = 10_000
const REVEAL_MS = 1100

export default function QuizScreen({
  duelId,
  questions,
  // сколько вопросов уже отвечено ранее: игрок мог закрыть
  // приложение на середине и вернуться по той же ссылке
  startIndex = 0,
  startCorrect = 0,
  onComplete,
  onError,
}) {
  const [index, setIndex] = useState(startIndex)
  // answering -> sending (ждём сервер) -> reveal (красим) -> следующий
  const [phase, setPhase] = useState('answering')
  const [selected, setSelected] = useState(null)
  const [correct, setCorrect] = useState(null)
  const [correctCount, setCorrectCount] = useState(startCorrect)

  const question = questions[index]
  const isLast = index === questions.length - 1
  const lockedRef = useRef(false) // защита от двойного тапа / тапа на таймауте

  // Правильный ответ приходит с сервера и только после того,
  // как наш выбор уже записан. Поэтому «подсмотреть» его нельзя.
  const submit = useCallback(
    async (answerIndex, elapsedMs) => {
      if (lockedRef.current) return
      lockedRef.current = true

      setSelected(answerIndex)
      setPhase('sending')
      haptic.tap()

      try {
        const res = await answerQuestion(duelId, index, answerIndex, elapsedMs)
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
    // index/duelId стабильны в рамках вопроса
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duelId, index],
  )

  const { remaining, elapsed } = useCountdown(
    QUESTION_MS,
    index,
    phase === 'answering',
    () => submit(null, QUESTION_MS),
  )

  // после показа результата — следующий вопрос или финиш
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
    if (phase === 'sending') return 'muted' // ждём вердикт сервера
    if (i === correct) return 'correct'
    if (i === selected) return 'wrong'
    return 'muted'
  }

  return (
    <Screen>
      {/* ---- прогресс по вопросам ---- */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-tg-hint">
          Вопрос {index + 1}
          <span className="text-tg-hint/60"> / {questions.length}</span>
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
              i < index
                ? 'bg-tg-accent'
                : i === index
                  ? 'bg-tg-accent/50'
                  : 'bg-white/8'
            }`}
          />
        ))}
      </div>

      {/* ---- таймер ---- */}
      <div className="mt-5">
        <TimerBar remaining={remaining} duration={QUESTION_MS} />
      </div>

      {/* ---- вопрос ---- */}
      <div key={question.id} className="animate-rise mt-7 mb-6">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-tg-accent">
          {question.category}
        </p>
        <h1 className="text-[22px] font-bold leading-snug">
          {question.question}
        </h1>
      </div>

      {/* ---- варианты ---- */}
      <div className="flex flex-col gap-2.5">
        {question.options.map((opt, i) => (
          <AnswerButton
            key={i}
            text={opt}
            index={i}
            state={optionState(i)}
            disabled={phase !== 'answering'}
            onClick={() => submit(i, Math.round(elapsed))}
          />
        ))}
      </div>

      {phase !== 'answering' && (
        <p className="mt-5 text-center text-sm text-tg-hint">
          {phase === 'sending'
            ? 'Проверяем…'
            : selected === null
              ? 'Время вышло'
              : selected === correct
                ? 'Верно!'
                : 'Мимо'}
        </p>
      )}
    </Screen>
  )
}
