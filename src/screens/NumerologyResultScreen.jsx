import Screen from '../components/Screen'
import BackButton from '../components/BackButton'

export default function NumerologyResultScreen({ result, onBack, onHome }) {
  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">{result.title}</h1>
      </header>

      <div className="animate-rise mt-5 flex flex-col gap-3.5">
        {result.numbers.map((n) => (
          <div key={n.slot} className="rounded-2xl border border-white/5 bg-tg-section p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-tg-accent/15 text-xl font-bold text-tg-accent">
                {n.number}
              </span>
              <span className="text-[15px] font-semibold">{n.title}</span>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-tg-hint">{n.description}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onHome}
        className="animate-rise mt-6 w-full rounded-2xl bg-tg-accent py-3.5 text-[15px] font-semibold text-tg-accent-text active:scale-[0.98]"
      >
        На главную
      </button>
    </Screen>
  )
}
