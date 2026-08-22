/**
 * Динамическая шкала времени. Цвет перетекает жёлтый -> красный
 * на последних секундах, чтобы давить на игрока.
 */
export default function TimerBar({ remaining, duration }) {
  const ratio = Math.max(0, Math.min(1, remaining / duration))
  const seconds = Math.ceil(remaining / 1000)

  const color =
    ratio > 0.5
      ? 'var(--color-quiz-right)'
      : ratio > 0.25
        ? 'var(--color-quiz-gold)'
        : 'var(--color-quiz-wrong)'

  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-tg-surface">
        <div
          className="h-full rounded-full"
          style={{
            width: `${ratio * 100}%`,
            background: color,
            transition: 'background-color 200ms linear',
          }}
        />
      </div>
      <span
        className="w-6 text-right text-sm font-bold tabular-nums"
        style={{ color }}
      >
        {seconds}
      </span>
    </div>
  )
}
