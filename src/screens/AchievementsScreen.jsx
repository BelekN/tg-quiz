import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import { Loader, ErrorView } from '../components/StateView'
import { fetchAchievements } from '../lib/api'
import { useBackButton } from '../hooks/useBackButton'

const dateFormatter = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' })

export default function AchievementsScreen({ onBack }) {
  const [state, setState] = useState({ status: 'loading', items: [] })

  useBackButton(onBack)

  useEffect(() => {
    let alive = true
    fetchAchievements()
      .then(({ items }) => {
        if (alive) setState({ status: 'ready', items })
      })
      .catch((e) => {
        if (alive) setState({ status: 'error', code: e.message, items: [] })
      })
    return () => {
      alive = false
    }
  }, [])

  if (state.status === 'loading') return <Loader label="Загружаем достижения…" />
  if (state.status === 'error') return <ErrorView code={state.code} onRetry={onBack} />

  const unlockedCount = state.items.filter((a) => a.unlocked_at).length

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-xl bg-tg-surface text-lg"
        >
          ←
        </button>
        <h1 className="text-lg font-bold">🏅 Достижения</h1>
        <span className="ml-auto text-sm font-semibold text-tg-hint tabular-nums">
          {unlockedCount}/{state.items.length}
        </span>
      </header>

      <div className="animate-rise mt-5 flex flex-col gap-2.5">
        {state.items.map((a) => (
          <div
            key={a.key}
            className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 ${
              a.unlocked_at
                ? 'border-quiz-gold/30 bg-quiz-gold/10'
                : 'border-white/5 bg-tg-section opacity-50'
            }`}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tg-bg/40 text-xl">
              {a.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{a.title}</p>
              <p className="truncate text-xs text-tg-hint">{a.description}</p>
            </div>
            {a.unlocked_at && (
              <span className="shrink-0 text-[11px] text-tg-hint">
                {dateFormatter.format(new Date(a.unlocked_at))}
              </span>
            )}
          </div>
        ))}
      </div>
    </Screen>
  )
}
