import { haptic } from '../../lib/telegram'

/**
 * CTA урока — в контенте, а не нативная MainButton: шаги урока
 * сменяются каждые несколько секунд, и кнопка должна стоять ровно под
 * тем, что человек только что прочитал (а в браузере/моке нативной
 * кнопки нет вовсе). mt-auto прижимает её к низу экрана на коротких шагах.
 */
export default function LessonButton({ children, onClick, disabled, variant = 'primary' }) {
  const skin =
    variant === 'primary'
      ? 'bg-tg-accent text-tg-accent-text'
      : 'bg-tg-surface text-tg-text'

  return (
    <div className="mt-auto pt-6">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          haptic.tap()
          onClick()
        }}
        className={`w-full rounded-2xl px-6 py-3.5 text-[15px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-40 ${skin}`}
      >
        {children}
      </button>
    </div>
  )
}
