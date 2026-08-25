import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import { Loader, ErrorView } from '../components/StateView'
import { fetchNumerologyTests, buyNumerologyTest } from '../lib/api'
import { haptic } from '../lib/telegram'
import { formatNumber } from '../lib/format'

export default function NumerologyListScreen({ user, onUpdateUser, onBack, onPick }) {
  const [state, setState] = useState({ status: 'loading', tests: [] })
  const [picking, setPicking] = useState(false)
  const [buying, setBuying] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let alive = true
    fetchNumerologyTests()
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

  const handlePick = async (test) => {
    if (picking || !test.unlocked) return
    setPicking(true)
    haptic.tap()
    try {
      await onPick(test)
    } finally {
      setPicking(false)
    }
  }

  const buyTest = async (key) => {
    if (buying) return
    haptic.tap()
    setBuying(key)
    setNotice(null)
    try {
      const res = await buyNumerologyTest(key)
      onUpdateUser(res.user)
      setState((s) => ({
        ...s,
        tests: s.tests.map((t) => (t.key === key ? { ...t, unlocked: true } : t)),
      }))
      haptic.success()
    } catch (e) {
      haptic.error()
      setNotice(e.message === 'NOT_ENOUGH_COINS' ? 'Не хватает монет.' : 'Не получилось купить, попробуйте снова.')
    } finally {
      setBuying(null)
    }
  }

  if (state.status === 'loading') return <Loader label="Загружаем тесты…" />
  if (state.status === 'error') return <ErrorView code={state.code} onRetry={onBack} />

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">🔢 Нумерология</h1>
      </header>
      <p className="mt-1 text-sm text-tg-hint">
        Введи дату рождения — без имени, только числа
      </p>

      {notice && (
        <p className="animate-rise mt-3 rounded-xl bg-tg-section px-3.5 py-2.5 text-center text-[13px] text-tg-text">
          {notice}
        </p>
      )}

      <div className="animate-rise mt-5 flex flex-col gap-2.5">
        {state.tests.map((t) => (
          <div
            key={t.key}
            className="flex items-center gap-3.5 rounded-2xl border border-white/5 bg-tg-section px-4 py-4"
          >
            <button
              type="button"
              disabled={picking || !t.unlocked}
              onClick={() => handlePick(t)}
              className="flex flex-1 items-center gap-3.5 text-left disabled:opacity-60"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tg-accent/15 text-xl">
                {t.unlocked ? t.icon : '🔒'}
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">{t.title}</span>
                <span className="block text-xs text-tg-hint">{t.description}</span>
              </span>
              {t.unlocked && <span className="text-tg-hint">›</span>}
            </button>
            {!t.unlocked && (
              <button
                type="button"
                disabled={buying === t.key || (user?.coins ?? 0) < t.price_coins}
                onClick={() => buyTest(t.key)}
                className="shrink-0 rounded-lg bg-tg-accent px-2.5 py-1.5 text-[11px] font-semibold text-tg-accent-text active:scale-95 disabled:opacity-40"
              >
                Открыть за {formatNumber(t.price_coins)}
              </button>
            )}
          </div>
        ))}
      </div>
    </Screen>
  )
}
