import { useEffect, useRef, useState } from 'react'
import AnswerButton from '../AnswerButton'
import Quote from './Quote'
import { haptic } from '../../lib/telegram'

const ADVANCE_MS = 350

/**
 * Итоговый тест: без подсказок по ходу — проверяет сервер, разбор
 * ошибок покажет экран результата. Порядок вариантов не перемешиваем:
 * варианты уже перемешаны сервером для этой попытки, он же переводит
 * индексы обратно при проверке (course_exam_order, 079).
 */
export default function ExamStep({ step, ui, busy, onDone }) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const answersRef = useRef([])
  const timerRef = useRef(null)
  // Ушёл назад в те 350 мс после последнего ответа — тест не отправляем.
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const q = step.questions[index]
  const isLast = index === step.questions.length - 1

  const pick = (i) => {
    if (picked !== null || busy) return
    haptic.tap()
    setPicked(i)
    answersRef.current[index] = i
    timerRef.current = setTimeout(() => {
      if (isLast) {
        onDone(answersRef.current)
        return
      }
      setIndex((x) => x + 1)
      setPicked(null)
    }, ADVANCE_MS)
  }

  return (
    <>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm font-semibold text-tg-hint">{ui.exam_prompt}</p>
        <p className="text-sm tabular-nums text-tg-hint">
          {index + 1}/{step.questions.length}
        </p>
      </div>
      <div key={q.id} className="animate-rise mt-3">
        <Quote>{q.quote}</Quote>
      </div>
      <div className="mt-5 flex flex-col gap-2.5">
        {q.options.map((opt, i) => (
          <AnswerButton
            key={`${q.id}:${opt}`}
            text={opt}
            index={i}
            state={picked === null ? 'idle' : picked === i ? 'selected' : 'muted'}
            disabled={picked !== null || busy}
            onClick={() => pick(i)}
          />
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-tg-hint">
        {busy ? 'Проверяем…' : `Чтобы получить сертификат, нужно ${step.passScore} из ${step.questions.length}`}
      </p>
    </>
  )
}
