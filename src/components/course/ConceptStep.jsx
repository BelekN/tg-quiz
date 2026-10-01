import LessonButton from './LessonButton'

/** Карточка уловки: что это, как распознать, как ответить. */
export default function ConceptStep({ step, onNext }) {
  return (
    <>
      <div className="animate-rise mt-6 rounded-3xl border border-white/5 bg-tg-section p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tg-accent/15 text-2xl">
            {step.icon}
          </span>
          <h1 className="text-[20px] font-bold leading-tight">{step.title}</h1>
        </div>
        <p className="mt-4 text-[15px] leading-relaxed">{step.definition}</p>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
          Как распознать
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {step.signs.map((s) => (
            <li key={s} className="flex gap-2 text-[14px] leading-snug">
              <span className="text-tg-accent">•</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 rounded-2xl bg-quiz-right/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-quiz-right">
            🛡 Как ответить
          </p>
          <p className="mt-1 text-[14px] leading-snug">{step.counter}</p>
        </div>

        {step.note && (
          <p className="mt-4 text-[13px] leading-relaxed text-tg-hint">💡 {step.note}</p>
        )}
      </div>
      <LessonButton onClick={onNext}>Понятно</LessonButton>
    </>
  )
}
