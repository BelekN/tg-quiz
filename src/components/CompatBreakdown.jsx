/** Постатейная разбивка теста на совместимость — какие ответы совпали, какие нет. */
export default function CompatBreakdown({ items }) {
  const matchedCount = items.filter((q) => q.matched).length

  return (
    <div className="w-full">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-tg-hint">
        Совпало {matchedCount} из {items.length}
      </p>
      <div className="flex flex-col gap-2">
        {items.map((q, i) => (
          <div
            key={i}
            className={`rounded-xl border px-3 py-2.5 text-left ${
              q.matched ? 'border-quiz-right/25 bg-quiz-right/5' : 'border-white/5 bg-tg-section'
            }`}
          >
            <p className="text-[13px] font-medium">
              {q.matched ? '✅' : '➖'} {q.question}
            </p>
            <p className="mt-1 text-xs text-tg-hint">Вы: {q.my_answer}</p>
            <p className="text-xs text-tg-hint">Партнёр: {q.partner_answer}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
