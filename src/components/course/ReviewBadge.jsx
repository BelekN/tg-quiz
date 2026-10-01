/** Метка «это повторение старого», чтобы было понятно, почему вернулась прошлая уловка. */
export default function ReviewBadge({ show }) {
  if (!show) return null
  return (
    <span className="mb-2 inline-block rounded-full bg-quiz-gold/15 px-2.5 py-1 text-[11px] font-semibold text-quiz-gold">
      🔁 Повторение
    </span>
  )
}
