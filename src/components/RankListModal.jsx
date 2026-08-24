import { RANK_TIERS, getRank } from '../lib/ranks'
import { formatNumber } from '../lib/format'

/** Полноэкранный список всех рангов — открывается тапом по «Всего очков». */
export default function RankListModal({ totalScore, onClose }) {
  const current = getRank(totalScore)

  return (
    <div className="safe-top fixed inset-0 z-50 flex flex-col bg-tg-bg">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full bg-tg-surface text-lg active:scale-95"
          aria-label="Закрыть"
        >
          ✕
        </button>
        <h1 className="text-lg font-bold">Ранги</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="flex flex-col gap-2">
          {RANK_TIERS.map((tier) => {
            const reached = (totalScore ?? 0) >= tier.min
            const isCurrent = tier.key === current.key

            return (
              <div
                key={tier.key}
                className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${
                  isCurrent
                    ? 'border-tg-accent bg-tg-accent/10'
                    : 'border-white/5 bg-tg-section'
                } ${reached ? '' : 'opacity-50'}`}
              >
                <span className="text-2xl">{tier.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{tier.name}</p>
                  <p className="text-xs text-tg-hint">
                    от {formatNumber(tier.min)} очков
                  </p>
                </div>
                {isCurrent && (
                  <span className="shrink-0 rounded-full bg-tg-accent px-2.5 py-1 text-[11px] font-semibold text-tg-accent-text">
                    Вы тут
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
