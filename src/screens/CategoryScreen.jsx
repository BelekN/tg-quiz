import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import { Loader, ErrorView } from '../components/StateView'
import { fetchCategories } from '../lib/api'
import { categoryMeta } from '../lib/categories'
import { haptic } from '../lib/telegram'

export default function CategoryScreen({ onBack, onPick }) {
  const [state, setState] = useState({ status: 'loading', categories: [] })
  // Блокируем повторный тап по любой карточке, пока предыдущий выбор
  // категории ещё в полёте — иначе двойной тап на разные категории
  // может доставить сюда старт-сессию уже после перехода на другой
  // экран и рассинхронизировать questions/session_id на нём.
  const [picking, setPicking] = useState(false)

  const handlePick = async (category) => {
    if (picking) return
    setPicking(true)
    haptic.tap()
    try {
      await onPick(category)
    } finally {
      setPicking(false)
    }
  }

  useEffect(() => {
    let alive = true
    fetchCategories()
      .then(({ categories }) => {
        if (alive) setState({ status: 'ready', categories })
      })
      .catch((e) => {
        if (alive) setState({ status: 'error', code: e.message, categories: [] })
      })
    return () => {
      alive = false
    }
  }, [])

  if (state.status === 'loading') return <Loader label="Загружаем категории…" />
  if (state.status === 'error') return <ErrorView code={state.code} onRetry={onBack} />

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
        <h1 className="text-lg font-bold">🧠 Квиз-тесты</h1>
      </header>
      <p className="mt-1 text-sm text-tg-hint">
        Выберите тему — 10 вопросов, без таймера, в своём темпе
      </p>

      <div className="animate-rise mt-5 flex flex-col gap-2.5">
        <button
          type="button"
          disabled={picking}
          onClick={() => handlePick('mixed')}
          className="flex w-full items-center gap-3.5 rounded-2xl border border-tg-accent/30 bg-tg-accent/10 px-4 py-4 text-left transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tg-accent/20 text-xl">
            🎲
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">Случайный микс</span>
            <span className="block text-xs text-tg-hint">
              Вопросы из всех категорий подряд
            </span>
          </span>
          <span className="text-tg-hint">›</span>
        </button>

        {state.categories.map(({ category, count }) => {
          const meta = categoryMeta(category)
          return (
            <button
              key={category}
              type="button"
              disabled={picking}
              onClick={() => handlePick(category)}
              className="flex w-full items-center gap-3.5 rounded-2xl border border-white/5 bg-tg-section px-4 py-4 text-left transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tg-accent/15 text-xl">
                {meta.icon}
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">
                  {meta.label}
                </span>
                <span className="block text-xs text-tg-hint">
                  {count} {pluralQuestions(count)}
                </span>
              </span>
              <span className="text-tg-hint">›</span>
            </button>
          )
        })}
      </div>
    </Screen>
  )
}

function pluralQuestions(n) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'вопрос'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'вопроса'
  return 'вопросов'
}
