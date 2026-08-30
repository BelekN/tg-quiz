import { haptic } from '../lib/telegram'

const TABS = [
  { key: 'home', icon: '🏠', label: 'Играть' },
  { key: 'fun-hub', icon: '🔮', label: 'Приятное' },
  { key: 'shop', icon: '🛍', label: 'Магазин' },
  { key: 'profile', icon: '👤', label: 'Профиль' },
]

/**
 * Нижний таббар — виден только на 4 корневых экранах (см. ROOT_TABS в
 * App.jsx). Во время самой игры (дуэль/спринт/квиз и т.п.) не рендерится
 * вовсе — полноэкранный фокус на игре, а не через css-скрытие.
 *
 * Крупные плашки (иконка + подпись внутри залитого закруглённого
 * блока у активной вкладки) — по образцу нижнего бара Telegram Wallet.
 *
 * Liquid Glass: плавающая капсула вместо сплошной полосы во всю
 * ширину — таббар статичен, поэтому backdrop-blur считается один раз
 * при появлении экрана, а не на каждый кадр скролла (в отличие от
 * шапки экрана, которую в стекло сознательно НЕ переводим).
 * px-3 на <nav> (не padding-bottom!) — safe-bottom уже занимает
 * padding-bottom этого узла, а margin/padding на других осях с ним
 * не конфликтует (см. TabBarSpacer.jsx про сам конфликт).
 */
export default function TabBar({ active, onChange, pendingChallenges = 0 }) {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-3">
      <div className="mx-auto mb-2 flex max-w-md items-stretch justify-between gap-1.5 rounded-[24px] border border-glass-border bg-glass-surface px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_10px_28px_-6px_rgba(0,0,0,0.45)] backdrop-blur-[22px] backdrop-saturate-150">
        {TABS.map((tab) => {
          const isActive = active === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                if (!isActive) haptic.tap()
                onChange(tab.key)
              }}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 transition-colors ${
                isActive ? 'bg-tg-accent/15' : ''
              }`}
            >
              <span className="relative text-[26px] leading-none">
                {tab.icon}
                {/* Непринятые вызовы на дуэль — точка на иконке "Играть",
                    видна с любой вкладки, а не только зайдя на Home. */}
                {tab.key === 'home' && pendingChallenges > 0 && (
                  <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-quiz-wrong ring-2 ring-tg-bg" />
                )}
              </span>
              <span
                className={`text-[13px] leading-none ${
                  isActive ? 'font-bold text-tg-accent' : 'font-medium text-tg-hint'
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
