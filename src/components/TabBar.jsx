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
 */
export default function TabBar({ active, onChange }) {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-tg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
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
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-tg-accent' : 'text-tg-hint'
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              {tab.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
