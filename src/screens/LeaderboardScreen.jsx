import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import Avatar from '../components/Avatar'
import BackButton from '../components/BackButton'
import { fetchLeaderboard, fetchCircleLeaderboard } from '../lib/api'
import { formatNumber } from '../lib/format'
import { badgeLabel } from '../lib/badges'
import { haptic } from '../lib/telegram'
import { Loader, ErrorView } from '../components/StateView'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function LeaderboardScreen({ onBack, onChallenge, onOpenProfile }) {
  const [tab, setTab] = useState('top')
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
    setState((s) => ({ ...s, status: 'loading' }))
    const fetchFn = tab === 'top' ? fetchLeaderboard : fetchCircleLeaderboard
    fetchFn()
      .then(({ top, me }) => {
        if (alive) setState({ status: 'ready', top: top ?? [], me })
      })
      .catch((e) => {
        if (alive) setState({ status: 'error', code: e.message, top: [], me: null })
      })
    return () => {
      alive = false
    }
  }, [tab])

  if (state.status === 'loading') return <Loader label="Считаем рейтинг…" />
  if (state.status === 'error') return <ErrorView code={state.code} onRetry={onBack} />

  // top уже включает текущего игрока, если он попал в топ-20
  const meInTop = state.me && state.top.some((p) => p.tg_id === state.me.tg_id)

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">🏆 Рейтинг</h1>
      </header>

      <div className="animate-rise mt-4 flex gap-1 rounded-2xl bg-tg-section p-1">
        {[
          { key: 'top', label: 'Топ недели' },
          { key: 'circle', label: 'Мои соперники' },
        ].map((seg) => (
          <button
            key={seg.key}
            type="button"
            onClick={() => {
              if (tab !== seg.key) haptic.tap()
              setTab(seg.key)
            }}
            className={`flex-1 rounded-xl py-2.5 text-[14px] font-bold transition-colors ${
              tab === seg.key ? 'bg-tg-accent text-tg-accent-text' : 'text-tg-hint'
            }`}
          >
            {seg.label}
          </button>
        ))}
      </div>

      {tab === 'top' && (
        <p className="mt-3 text-sm text-tg-hint">Обнуляется каждый понедельник — у всех равные шансы на новую неделю</p>
      )}

      <div className="animate-rise mt-5 flex flex-col gap-2">
        {tab === 'circle' && state.top.length <= 1 && (
          <p className="mt-8 text-center text-sm text-tg-hint">
            Пока нет завершённых дуэлей ни с кем — сыграйте первую!
          </p>
        )}
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
            onOpenProfile={onOpenProfile}
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

function Row({ player, isMe, onChallenge, onOpenProfile, busy }) {
  const name = player.first_name || player.username || 'Игрок'
  const medal = MEDAL[player.rank]
  const canOpenProfile = !isMe && onOpenProfile
  const IdentityTag = canOpenProfile ? 'button' : 'div'

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
      <IdentityTag
        type={canOpenProfile ? 'button' : undefined}
        onClick={canOpenProfile ? () => onOpenProfile(player.tg_id) : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
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
      </IdentityTag>
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
