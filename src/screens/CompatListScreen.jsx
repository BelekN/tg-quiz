import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import { Loader, ErrorView } from '../components/StateView'
import { fetchCompatTests } from '../lib/api'
import { haptic } from '../lib/telegram'

export default function CompatListScreen({ onBack, onPick }) {
  const [state, setState] = useState({ status: 'loading', tests: [] })
  // Та же защита от дабл-тапа, что в CategoryScreen/PersonaListScreen.
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    let alive = true
    fetchCompatTests()
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

  const handlePick = async (key) => {
    if (picking) return
    setPicking(true)
    haptic.tap()
    try {
      await onPick(key)
    } finally {
      setPicking(false)
    }
  }

  if (state.status === 'loading') return <Loader label="Загружаем тесты…" />
  if (state.status === 'error') return <ErrorView code={state.code} onRetry={onBack} />

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">💞 Совместимость</h1>
      </header>
      <p className="mt-1 text-sm text-tg-hint">
        Ответь сам, позови партнёра или друга — сравним ответы и покажем % совпадения
      </p>

      <div className="animate-rise mt-5 flex flex-col gap-2.5">
        {state.tests.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={picking}
            onClick={() => handlePick(t.key)}
            className="flex w-full items-center gap-3.5 rounded-2xl border border-white/5 bg-tg-section px-4 py-4 text-left transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tg-accent/15 text-xl">
              {t.icon}
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">{t.title}</span>
              <span className="block text-xs text-tg-hint">{t.description}</span>
            </span>
            <span className="text-tg-hint">›</span>
          </button>
        ))}
      </div>
    </Screen>
  )
}
