import { useEffect, useState } from 'react'
import ChatBubbles from './ChatBubbles'
import LessonButton from './LessonButton'
import { haptic } from '../../lib/telegram'

const MESSAGE_DELAY_MS = 700

/**
 * Теория через живой пример: реплики появляются по одной, как в чате,
 * потом человек сам жмёт «Где подвох?» — и подсвечивается реплика с
 * уловкой. Сначала попробовать заметить самому, потом увидеть ответ.
 */
export default function ChatStep({ step, ui, cardTitle, onNext }) {
  const [visible, setVisible] = useState(1)
  const [revealed, setRevealed] = useState(false)
  const allShown = visible >= step.messages.length

  useEffect(() => {
    if (allShown) return
    const t = setTimeout(() => setVisible((v) => v + 1), MESSAGE_DELAY_MS)
    return () => clearTimeout(t)
  }, [visible, allShown])

  const flagIndex = step.messages.findIndex((m) => m.flag)
  const good = ui.flag_tone === 'good'
  const marks = revealed && flagIndex >= 0 ? { [flagIndex]: good ? 'good' : 'flag' } : {}

  return (
    <>
      <p className="mt-6 text-sm font-semibold text-tg-hint">💬 Прочитай переписку</p>
      <div className="mt-3">
        <ChatBubbles messages={step.messages} visible={visible} marks={marks} flagIcon={ui.flag_icon} />
      </div>

      {revealed && (
        <div className="animate-rise mt-4 rounded-2xl bg-tg-section px-4 py-3.5">
          {cardTitle && (
            <p className={`text-sm font-bold ${good ? 'text-quiz-right' : 'text-quiz-wrong'}`}>
              {ui.flag_icon} {cardTitle}
            </p>
          )}
          <p className="mt-1 text-[14px] leading-relaxed">{step.caption}</p>
        </div>
      )}

      {revealed ? (
        <LessonButton onClick={onNext}>Дальше</LessonButton>
      ) : (
        <LessonButton
          disabled={!allShown}
          onClick={() => {
            haptic.success()
            setRevealed(true)
          }}
        >
          {ui.reveal_cta}
        </LessonButton>
      )}
    </>
  )
}
