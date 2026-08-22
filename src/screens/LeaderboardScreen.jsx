import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import Avatar from '../components/Avatar'
import { fetchLeaderboard } from '../lib/api'
import { Loader, ErrorView } from '../components/StateView'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function LeaderboardScreen({ onBack }) {
  const [state, setState] = useState({ status: 'loading', top: [], me: null })

  useEffect(() => {
    let alive = true
    fetchLeaderboard()
      .then(({ top, me }) => {
        if (alive) setState({ status: 'ready', top: top ?? [], me })
      })
      .catch((e) => {
        if (alive) setState({ status: 'error', code: e.message, top: [], me: null })
      })
    return () => {
      alive = false
    }
  }, [])

  if (state.status === 'loading') return <Loader label="Считаем рейтинг…" />
  if (state.status === 'error') return <ErrorView code={state.code} onRetry={onBack} />

  // top уже включает текущего игрока, если он попал в топ-20
  const meInTop = state.me && state.top.some((p) => p.tg_id === state.me.tg_id)

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
        <h1 className="text-lg font-bold">🏆 Рейтинг</h1>
      </header>

      <div className="animate-rise mt-5 flex flex-col gap-2">
        {state.top.length === 0 && (
          <p className="mt-8 text-center text-sm text-tg-hint">
            Пока никто не набрал очков — будьте первым!
          </p>
        )}

        {state.top.map((p) => (
          <Row key={p.tg_id} player={p} isMe={p.tg_id === state.me?.tg_id} />
        ))}
      </div>

      {/* закреплённая карточка «я», если не попал в топ-20 */}
      {state.me && !meInTop && (
        <div className="sticky bottom-0 mt-3 pt-2">
          <div className="rounded-2xl border-t-2 border-tg-accent bg-tg-bg pt-1">
            <Row player={state.me} isMe />
          </div>
        </div>
      )}
    </Screen>
  )
}

function Row({ player, isMe }) {
  const name = player.first_name || player.username || 'Игрок'
  const medal = MEDAL[player.rank]

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
        isMe
          ? 'border-tg-accent bg-tg-accent/10'
          : 'border-white/5 bg-tg-section'
      }`}
    >
      <span className="w-7 text-center text-base font-bold tabular-nums text-tg-hint">
        {medal ?? player.rank}
      </span>
      <Avatar src={player.photo_url} name={name} size={38} />
      <span className="flex-1 truncate text-[15px] font-medium">
        {name}
        {isMe && <span className="ml-1.5 text-xs text-tg-hint">(вы)</span>}
      </span>
      <span className="text-[15px] font-bold tabular-nums">
        {player.total_score}
      </span>
    </div>
  )
}
