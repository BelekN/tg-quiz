import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import Avatar from '../components/Avatar'
import { fetchRivals } from '../lib/api'
import { pluralGames } from '../lib/format'
import { haptic } from '../lib/telegram'
import { Loader, ErrorView } from '../components/StateView'

/** С кем чаще всего играешь в дуэли и какой счёт побед — по завершённым дуэлям. */
export default function RivalsScreen({ onBack, onChallenge }) {
  const [state, setState] = useState({ status: 'loading', items: [] })
  const [busyTgId, setBusyTgId] = useState(null)

  const challenge = async (tgId) => {
    if (busyTgId) return
    haptic.tap()
    setBusyTgId(tgId)
    try {
      await onChallenge(tgId)
    } finally {
      setBusyTgId(null)
    }
  }

  useEffect(() => {
    let alive = true
    fetchRivals()
      .then(({ items }) => {
        if (alive) setState({ status: 'ready', items: items ?? [] })
      })
      .catch((e) => {
        if (alive) setState({ status: 'error', code: e.message, items: [] })
      })
    return () => {
      alive = false
    }
  }, [])

  if (state.status === 'loading') return <Loader label="Считаем счёт…" />
  if (state.status === 'error') return <ErrorView code={state.code} onRetry={onBack} />

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">🤝 Соперники</h1>
      </header>
      <p className="mt-1 text-sm text-tg-hint">Счёт побед в завершённых дуэлях, от самых частых соперников</p>

      <div className="animate-rise mt-5 flex flex-col gap-2">
        {state.items.length === 0 && (
          <p className="mt-8 text-center text-sm text-tg-hint">
            Пока нет завершённых дуэлей ни с кем — сыграйте первую!
          </p>
        )}

        {state.items.map((r) => {
          const name = r.first_name || r.username || 'Игрок'
          return (
            <div key={r.tg_id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-tg-section px-3 py-2.5">
              <Avatar
                src={r.photo_url}
                avatarKey={r.avatar_key}
                frameKey={r.equipped_frame}
                name={name}
                size={40}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{name}</span>
                <span className="block text-xs text-tg-hint">
                  {r.games} {pluralGames(r.games)}
                  {r.draws > 0 ? ` · ${r.draws} вничью` : ''}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="text-[17px] font-bold tabular-nums">
                  {r.wins}:{r.losses}
                </span>
                <button
                  type="button"
                  disabled={busyTgId === r.tg_id}
                  onClick={() => challenge(r.tg_id)}
                  className="grid h-6 w-6 place-items-center rounded-full bg-tg-accent/15 text-xs disabled:opacity-40"
                  aria-label={`Вызвать ${name} снова`}
                >
                  ⚔️
                </button>
              </span>
            </div>
          )
        })}
      </div>
    </Screen>
  )
}
