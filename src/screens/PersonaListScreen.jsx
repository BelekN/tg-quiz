import { useEffect, useMemo, useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import { Loader, ErrorView } from '../components/StateView'
import { fetchPersonaTests, buyPersonaCategory } from '../lib/api'
import { haptic } from '../lib/telegram'
import { formatNumber } from '../lib/format'

export default function PersonaListScreen({ user, onUpdateUser, onBack, onPick }) {
  const [state, setState] = useState({ status: 'loading', tests: [] })
  // Та же защита от дабл-тапа, что в CategoryScreen — иначе второй тап
  // по другому тесту может прилететь сюда уже после перехода на квиз.
  const [picking, setPicking] = useState(false)
  const [buyingCategory, setBuyingCategory] = useState(null)
  const [notice, setNotice] = useState(null)

  const handlePick = async (test) => {
    if (picking || !test.unlocked) return
    setPicking(true)
    haptic.tap()
    try {
      await onPick(test.key)
    } finally {
      setPicking(false)
    }
  }

  const buyCategory = async (category) => {
    if (buyingCategory) return
    haptic.tap()
    setBuyingCategory(category)
    setNotice(null)
    try {
      const res = await buyPersonaCategory(category)
      onUpdateUser(res.user)
      setState((s) => ({
        ...s,
        tests: s.tests.map((t) => (t.category === category ? { ...t, unlocked: true } : t)),
      }))
      haptic.success()
    } catch (e) {
      haptic.error()
      setNotice(e.message === 'NOT_ENOUGH_COINS' ? 'Не хватает монет.' : 'Не получилось купить, попробуйте снова.')
    } finally {
      setBuyingCategory(null)
    }
  }

  useEffect(() => {
    let alive = true
    fetchPersonaTests()
      .then(({ items }) => {
        if (alive) setState({ status: 'ready', tests: items })
      })
      .catch((e) => {
        if (alive) setState({ status: 'error', code: e.message, tests: [] })
      })
    return () => {
      alive = false
    }
  }, [])

  // Группируем по категории, сохраняя порядок первого появления — как
  // и в AchievementsScreen, категорию и порядок внутри неё задаёт
  // сервер через ord, здесь просто разбиваем на секции.
  const groups = useMemo(() => {
    const list = []
    for (const t of state.tests) {
      let g = list.find((x) => x.category === t.category)
      if (!g) {
        g = { category: t.category, tests: [] }
        list.push(g)
      }
      g.tests.push(t)
    }
    return list
  }, [state.tests])

  if (state.status === 'loading') return <Loader label="Загружаем тесты…" />
  if (state.status === 'error') return <ErrorView code={state.code} onRetry={onBack} />

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">🔮 Узнай себя</h1>
      </header>
      <p className="mt-1 text-sm text-tg-hint">
        10 вопросов, 2 минуты — и неожиданный результат про тебя
      </p>

      {notice && (
        <p className="animate-rise mt-3 rounded-xl bg-tg-section px-3.5 py-2.5 text-center text-[13px] text-tg-text">
          {notice}
        </p>
      )}

      {groups.map((g) => {
        const price = g.tests[0]?.price_coins ?? 0
        const categoryLocked = price > 0 && !g.tests.every((t) => t.unlocked)

        return (
          <section key={g.category} className="animate-rise mt-6">
            <div className="mb-2.5 flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
                {g.category}
              </p>
              {categoryLocked && (
                <button
                  type="button"
                  disabled={buyingCategory === g.category || (user?.coins ?? 0) < price}
                  onClick={() => buyCategory(g.category)}
                  className="shrink-0 rounded-lg bg-tg-accent px-2.5 py-1 text-[11px] font-semibold text-tg-accent-text active:scale-95 disabled:opacity-40"
                >
                  🔒 Открыть за {formatNumber(price)}
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2.5">
              {g.tests.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  disabled={picking || !t.unlocked}
                  onClick={() => handlePick(t)}
                  className="flex w-full items-center gap-3.5 rounded-2xl border border-white/5 bg-tg-section px-4 py-4 text-left transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tg-accent/15 text-xl">
                    {t.unlocked ? t.icon : '🔒'}
                  </span>
                  <span className="flex-1">
                    <span className="block text-[15px] font-semibold">{t.title}</span>
                    <span className="block text-xs text-tg-hint">{t.description}</span>
                  </span>
                  <span className="text-tg-hint">›</span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </Screen>
  )
}
