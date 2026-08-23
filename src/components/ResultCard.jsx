import Screen from './Screen'

/**
 * Общий каркас экрана результата (дуэль/соло/спринт различаются
 * только вердиктом, метриками и действиями, а не разметкой).
 */
export default function ResultCard({
  icon,
  title,
  titleColor = '',
  subtitle,
  primaryStat,
  rows = [],
  coinsEarned,
  primaryAction,
  secondaryAction,
  footnote,
}) {
  return (
    <Screen className="justify-center">
      <div className="animate-pop text-center">
        <div className="text-6xl">{icon}</div>
        <h1 className={`mt-3 text-2xl font-bold ${titleColor}`}>{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-tg-hint">{subtitle}</p>}
      </div>

      <div className="animate-rise mt-7 rounded-3xl border border-white/5 bg-tg-section p-5">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-wider text-tg-hint">
            {primaryStat.label}
          </p>
          <p className="text-4xl font-bold tabular-nums">{primaryStat.value}</p>
        </div>

        {rows.map((row) => (
          <div
            key={row.label}
            className="mt-4 flex items-center justify-between border-t border-white/5 pt-4 text-sm"
          >
            <span className="text-tg-hint">{row.label}</span>
            <span className="font-semibold tabular-nums">{row.value}</span>
          </div>
        ))}

        {coinsEarned !== undefined && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-quiz-gold/10 px-3 py-2.5">
            <span className="text-sm text-tg-hint">Начислено монет</span>
            <span className="font-bold text-quiz-gold tabular-nums">
              +{coinsEarned}
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="w-full rounded-2xl bg-tg-accent px-5 py-4 text-[16px] font-semibold text-tg-accent-text shadow-lg shadow-tg-accent/20 transition-transform active:scale-[0.98]"
          >
            {primaryAction.label}
          </button>
        )}

        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="w-full rounded-2xl bg-tg-surface px-5 py-4 text-[15px] font-medium text-tg-text transition-transform active:scale-[0.98]"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>

      {footnote}
    </Screen>
  )
}
