import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import Avatar from '../components/Avatar'
import BackButton from '../components/BackButton'
import { fetchLeaderboard } from '../lib/api'
import { formatNumber } from '../lib/format'
import { badgeLabel } from '../lib/badges'
import { Loader, ErrorView } from '../components/StateView'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function LeaderboardScreen({ onBack, onChallenge }) {
  const [state, setState] = useState({ status: 'loading', top: [], me: null })
  const [busyTgId, setBusyTgId] = useState(null)

  const challenge = async (tgId) => {
    if (busyTgId) return
    setBusyTgId(tgId)
    try {
      await onChallenge(tgId)
    } finally {
      setBusyTgId(null)
    }
  }

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
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">🏆 Рейтинг недели</h1>
      </header>
      <p className="mt-1 text-sm text-tg-hint">Обнуляется каждый понедельник — у всех равные шансы на новую неделю</p>

      <div className="animate-rise mt-5 flex flex-col gap-2">
        {state.top.length === 0 && (
          <p className="mt-8 text-center text-sm text-tg-hint">
            Пока никто не набрал очков — будьте первым!
          </p>
        )}

        {state.top.map((p) => (
          <Row
            key={p.tg_id}
            player={p}
            isMe={p.tg_id === state.me?.tg_id}
            onChallenge={challenge}
            busy={busyTgId === p.tg_id}
          />
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

function Row({ player, isMe, onChallenge, busy }) {
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
      <Avatar
        src={player.photo_url}
        avatarKey={player.avatar_key}
        frameKey={player.equipped_frame}
        name={name}
        size={38}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">
          {name}
          {isMe && <span className="ml-1.5 text-xs text-tg-hint">(вы)</span>}
        </span>
        {badgeLabel(player.equipped_badge) && (
          <span className="block truncate text-xs font-medium text-tg-accent">
            {badgeLabel(player.equipped_badge)}
          </span>
        )}
        {player.city && (
          <span className="block truncate text-xs text-tg-hint">
            {player.city}
          </span>
        )}
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className="text-[15px] font-bold tabular-nums">
          {formatNumber(player.weekly_score)}
        </span>
        {!isMe && onChallenge && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onChallenge(player.tg_id)}
            className="grid h-6 w-6 place-items-center rounded-full bg-tg-accent/15 text-xs disabled:opacity-40"
            aria-label={`Вызвать ${name}`}
          >
            ⚔️
          </button>
        )}
      </span>
    </div>
  )
}
