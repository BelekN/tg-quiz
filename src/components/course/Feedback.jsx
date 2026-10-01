/** Вердикт + объяснение после ответа на упражнение. */
export default function Feedback({ ok, explain, title }) {
  return (
    <div
      className={`animate-rise mt-4 rounded-2xl border px-4 py-3.5 ${
        ok ? 'border-quiz-right/40 bg-quiz-right/10' : 'border-quiz-wrong/40 bg-quiz-wrong/10'
      }`}
    >
      <p className={`text-sm font-bold ${ok ? 'text-quiz-right' : 'text-quiz-wrong'}`}>
        {title ?? (ok ? '✓ Верно!' : '✕ Не совсем')}
      </p>
      {explain && <p className="mt-1 text-[14px] leading-relaxed text-tg-text">{explain}</p>}
    </div>
  )
}
