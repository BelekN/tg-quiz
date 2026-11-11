import { useCallback, useEffect, useRef, useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import AnswerButton from '../components/AnswerButton'
import Feedback from '../components/course/Feedback'
import LessonButton from '../components/course/LessonButton'
import PddSign from '../components/pdd/PddSign'
import { haptic } from '../lib/telegram'
import { formatClock } from '../lib/pdd'

const ADVANCE_MS = 350

function useDeadline(deadline, onExpire) {
  const [left, setLeft] = useState(() => (deadline ? deadline - Date.now() : 0))
  const expireRef = useRef(onExpire)
  useEffect(() => {
    expireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    if (!deadline) return
    // Раз в полсекунды по реальным часам: таймер не «плывёт» и не
    // перерисовывает весь экран 60 раз в секунду 25 минут подряд.
    const tick = () => {
      const ms = deadline - Date.now()
      setLeft(ms)
      if (ms <= 0) {
        clearInterval(id)
        expireRef.current?.()
      }
    }
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [deadline])

  return left
}

/**
 * Прохождение ПДД. session.mode:
 *   'training' — после ответа сразу верно/неверно и объяснение;
 *   'exam'     — без подсказок, общий таймер, проверяет сервер.
 * Варианты уже перемешаны (lib/pdd.js → shuffleQuestion), здесь индексы
 * — в показанном порядке.
 */
export default function PddQuizScreen({ session, onFinish, onExit }) {
  const isExam = session.mode === 'exam'
  const { questions } = session
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const answersRef = useRef([])
  const correctRef = useRef(0)
  const doneRef = useRef(false)
  const timerRef = useRef(null)
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const q = questions[index]
  const isLast = index === questions.length - 1

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    clearTimeout(timerRef.current)
    onFinish({
      answers: questions.map((_, i) => answersRef.current[i] ?? null),
      correct: correctRef.current,
      total: questions.length,
    })
  }, [onFinish, questions])

  const left = useDeadline(isExam ? session.deadline : null, finish)

  const next = () => {
    if (isLast) {
      finish()
      return
    }
    setIndex((x) => x + 1)
    setPicked(null)
  }

  const pick = (i) => {
    if (picked !== null || doneRef.current) return
    setPicked(i)
    answersRef.current[index] = i
    if (isExam) {
      haptic.tap()
      timerRef.current = setTimeout(next, ADVANCE_MS)
      return
    }
    if (i === q.answer) {
      correctRef.current += 1
      haptic.success()
    } else {
      haptic.error()
    }
  }

  const exit = () => {
    if (isExam && !window.confirm('Выйти из экзамена? Попытка не будет засчитана.')) return
    doneRef.current = true
    onExit()
  }

  const state = (i) => {
    if (picked === null) return 'idle'
    if (isExam) return picked === i ? 'selected' : 'muted'
    if (i === q.answer) return 'correct'
    return i === picked ? 'wrong' : 'muted'
  }

  const lowTime = isExam && left < 60_000

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={exit} />
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold">
          {session.icon} {session.title}
        </h1>
        {isExam && (
          <span
            className={`rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ${
              lowTime ? 'bg-quiz-wrong/15 text-quiz-wrong' : 'bg-white/8'
            }`}
          >
            ⏱ {formatClock(left)}
          </span>
        )}
      </header>

      <div className="mt-3 flex gap-1">
        {questions.map((item, i) => (
          <span
            key={item.id}
            className={`h-1.5 flex-1 rounded-full ${
              i < index ? 'bg-tg-accent' : i === index ? 'bg-tg-accent/60' : 'bg-white/8'
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs tabular-nums text-tg-hint">
        Вопрос {index + 1} из {questions.length}
      </p>

      <div key={q.id} className="animate-rise">
        {q.sign && (
          <div className="mt-4 flex justify-center">
            <PddSign sign={q.sign} size={128} />
          </div>
        )}
        <p className="mt-4 text-[17px] font-semibold leading-snug">{q.question}</p>

        <div className="mt-5 flex flex-col gap-2.5">
          {q.options.map((opt, i) => (
            <AnswerButton
              key={`${q.id}:${opt}`}
              text={opt}
              index={i}
              state={state(i)}
              disabled={picked !== null}
              onClick={() => pick(i)}
            />
          ))}
        </div>
      </div>

      {!isExam && picked !== null && (
        <>
          <Feedback ok={picked === q.answer} explain={q.explain} />
          <LessonButton onClick={next}>{isLast ? 'Результат' : 'Дальше'}</LessonButton>
        </>
      )}
      {isExam && (
        <p className="mt-auto pt-6 text-center text-xs text-tg-hint">
          Ответы проверим в конце. Можно ошибиться не больше {session.rules.max_errors} раз.
        </p>
      )}
    </Screen>
  )
}
