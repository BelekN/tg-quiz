import { useEffect, useMemo, useState } from 'react'
import Screen from '../components/Screen'
import TabBarSpacer from '../components/TabBarSpacer'
import ModeCard from '../components/ModeCard'
import { Loader, ErrorView } from '../components/StateView'
import { fetchCourses } from '../lib/api'
import { haptic } from '../lib/telegram'
import { groupLearnCatalog } from '../lib/learnCatalog'

function courseStatus(c) {
  if (c.completed) return '🏅 Пройден — сертификат получен'
  if (!c.started) return c.subtitle
  if (c.available_today) return `День ${c.days_done + 1} из ${c.total_days} ждёт тебя`
  return `День ${c.days_done} из ${c.total_days} пройден · следующий завтра`
}

function CourseCard({ course: c, iconBg, onOpen }) {
  const progress = Math.round((c.days_done / c.total_days) * 100)
  return (
    <button
      type="button"
      onClick={() => {
        haptic.tap()
        onOpen(c.key)
      }}
      className="relative overflow-hidden rounded-3xl border border-white/5 bg-tg-section p-4 text-left transition-transform active:scale-[0.98]"
    >
      <div className="flex items-center gap-3.5">
        <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl ${iconBg}`}>
          {c.icon}
        </span>
        <span className="flex-1">
          <span className="block text-[16px] font-bold leading-tight">{c.title}</span>
          <span className="mt-0.5 block text-xs text-tg-hint">{courseStatus(c)}</span>
        </span>
        {c.started && !c.completed && c.available_today && (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-quiz-wrong" />
        )}
      </div>
      {c.started && (
        <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className={`h-full rounded-full ${c.completed ? 'bg-quiz-gold' : 'bg-quiz-right'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {!c.started && (
        <span className="mt-3 inline-block rounded-full bg-quiz-right/15 px-2.5 py-1 text-[11px] font-semibold text-quiz-right">
          Бесплатно
        </span>
      )}
    </button>
  )
}

/**
 * Вкладка «Учёба» — мини-курсы: 3–5 минут в день, 7 дней, сертификат.
 * Без очков и рейтинга, как и «Для удовольствия». Курсы разложены по
 * разделам (lib/learnCatalog.js), сверху — чипы-фильтры по разделам.
 */
export default function LearnScreen({ onOpenCourse }) {
  const [state, setState] = useState({ status: 'loading', items: [] })
  const [filter, setFilter] = useState('all')
  const groups = useMemo(() => groupLearnCatalog(state.items), [state.items])

  useEffect(() => {
    let alive = true
    fetchCourses()
      .then(({ items }) => alive && setState({ status: 'ready', items }))
      .catch((e) => alive && setState({ status: 'error', code: e.message, items: [] }))
    return () => {
      alive = false
    }
  }, [])

  if (state.status === 'loading') return <Loader label="Загружаем курсы…" />
  if (state.status === 'error') return <ErrorView code={state.code} />

  return (
    <Screen>
      <header>
        <h1 className="text-lg font-bold">📚 Учёба</h1>
      </header>
      <p className="mt-1 text-sm text-tg-hint">
        3–5 минут в день: немного теории, немного практики — и через 7 дней тема твоя
      </p>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {[{ key: 'all', icon: '✨', title: 'Все' }, ...groups].map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => {
              if (filter !== g.key) haptic.tap()
              setFilter(g.key)
            }}
            className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${
              filter === g.key ? 'bg-tg-accent text-tg-accent-text' : 'bg-tg-section text-tg-hint'
            }`}
          >
            {g.icon} {g.title}
          </button>
        ))}
      </div>

      {groups
        .filter((g) => filter === 'all' || g.key === filter)
        .map((g) => (
          <section key={g.key} className="animate-rise mt-5">
            <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
              {g.icon} {g.title}
            </p>
            <div className="flex flex-col gap-2.5">
              {g.courses.map((c) => (
                <CourseCard key={c.key} course={c} iconBg={g.iconBg} onOpen={onOpenCourse} />
              ))}
              {g.upcoming.map((u) => (
                <ModeCard key={u.title} icon={u.icon} title={u.title} subtitle={u.subtitle} soon />
              ))}
            </div>
          </section>
        ))}

      <TabBarSpacer />
    </Screen>
  )
}
