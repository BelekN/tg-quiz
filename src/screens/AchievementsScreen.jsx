import { useEffect, useMemo, useState } from 'react'
import Screen from '../components/Screen'
import AchievementDetail from '../components/AchievementDetail'
import { Loader, ErrorView } from '../components/StateView'
import { fetchAchievements } from '../lib/api'
import { haptic } from '../lib/telegram'
import { useBackButton } from '../hooks/useBackButton'

export default function AchievementsScreen({ onBack }) {
  const [state, setState] = useState({ status: 'loading', items: [] })
  const [selected, setSelected] = useState(null)

  // Открытая карточка награды закрывается нативной BackButton, а не
  // уводит сразу на главную — как и сам экран, только на уровень выше.
  useBackButton(selected ? () => setSelected(null) : onBack)

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

  // Группируем по категории, сохраняя порядок первого появления —
  // категория (и порядок внутри неё) задаётся сервером через ord,
  // здесь просто разбиваем на секции, не выдумывая свой список имён.
  const groups = useMemo(() => {
    const list = []
    for (const a of state.items) {
      let g = list.find((x) => x.category === a.category)
      if (!g) {
        g = { category: a.category, items: [] }
        list.push(g)
      }
      g.items.push(a)
    }
    return list
  }, [state.items])

  if (state.status === 'loading') return <Loader label="Загружаем награды…" />
  if (state.status === 'error') return <ErrorView code={state.code} onRetry={onBack} />

  const unlockedCount = state.items.filter((a) => a.unlocked_at).length

  const openBadge = (a) => {
    haptic.tap()
    setSelected(a)
  }

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
      </header>

      <div className="mt-1 text-center">
        <h1 className="text-2xl font-bold">🏅 Награды</h1>
        <p className="mt-1 text-sm text-tg-hint">
          Открыто {unlockedCount} из {state.items.length}
        </p>
      </div>

      {groups.map((g) => (
        <section key={g.category} className="animate-rise mt-6">
          <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
            {g.category}
          </p>
          <div className="grid grid-cols-3 gap-y-4">
            {g.items.map((a) => (
              <Badge key={a.key} achievement={a} onClick={() => openBadge(a)} />
            ))}
          </div>
        </section>
      ))}

      {selected && (
        <AchievementDetail achievement={selected} onClose={() => setSelected(null)} />
      )}
    </Screen>
  )
}

function Badge({ achievement, onClick }) {
  const unlocked = Boolean(achievement.unlocked_at)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 px-1 text-center transition-transform active:scale-95"
    >
      <span
        className={`relative grid h-16 w-16 place-items-center rounded-full border-2 text-3xl ${
          unlocked
            ? 'border-quiz-gold/50 bg-quiz-gold/10'
            : 'border-white/10 bg-tg-section opacity-40 grayscale'
        }`}
      >
        {achievement.icon}
        {!unlocked && (
          <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border border-white/10 bg-tg-bg text-[10px] leading-none">
            🔒
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-[11px] font-medium leading-tight">
        {achievement.title}
      </span>
      {achievement.progress && (
        <span className="text-[10px] tabular-nums text-tg-hint">
          {achievement.progress.current}/{achievement.progress.target}
        </span>
      )}
    </button>
  )
}
