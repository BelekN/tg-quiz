import Screen from './Screen'
import { useMainButton, useSecondaryButton } from '../hooks/useBottomButton'

/**
 * Общий каркас экрана результата (дуэль/соло/спринт различаются
 * только вердиктом, метриками и действиями, а не разметкой).
 *
 * primaryAction/secondaryAction теперь не рисуются в контенте —
 * это нативные MainButton/SecondaryButton Telegram внизу экрана.
 * tertiaryAction (например, "поделиться в историю") остаётся обычной
 * кнопкой в контенте: Telegram не даёт больше двух нативных кнопок.
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
  tertiaryAction,
  footnote,
}) {
  // Без primaryAction (например, дуэль уже завершена и звать больше
  // некого) secondaryAction — единственное действие. SecondaryButton
  // без видимой MainButton — недокументированная конфигурация, поэтому
  // в этом случае просто отдаём его как MainButton, а не рискуем.
  const mainAction = primaryAction ?? secondaryAction
  const extraAction = primaryAction ? secondaryAction : null

  useMainButton({
    text: mainAction?.label,
    onClick: mainAction?.onClick,
  })
  useSecondaryButton({
    text: extraAction?.label,
    onClick: extraAction?.onClick,
  })

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

      {tertiaryAction && (
        <button
          type="button"
          onClick={tertiaryAction.onClick}
          className="mt-5 text-center text-sm font-medium text-tg-link active:opacity-70"
        >
          {tertiaryAction.label}
        </button>
      )}

      {footnote}
    </Screen>
  )
}
