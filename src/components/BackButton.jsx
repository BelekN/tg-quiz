import { useBackButton } from '../hooks/useBackButton'
import { backButton } from '../lib/telegram'

/**
 * Единая точка входа для "назад" на всех экранах. Раньше каждый экран
 * одновременно регистрировал нативную BackButton Telegram (в шапке
 * клиента) И рисовал свою "←" в контенте — в настоящем Telegram, где
 * нативная доступна, это были две видимые кнопки назад одновременно.
 * Здесь своя "←" рисуется только тогда, когда нативная недоступна
 * (браузер, VITE_DEV_MOCK) — ровно тот случай, когда без неё вернуться
 * было бы вообще нечем.
 */
export default function BackButton({ onBack, className = '' }) {
  useBackButton(onBack)

  if (!onBack || backButton.show.isAvailable()) return null

  return (
    <button
      type="button"
      onClick={onBack}
      aria-label="Назад"
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tg-surface text-lg ${className}`}
    >
      ←
    </button>
  )
}
