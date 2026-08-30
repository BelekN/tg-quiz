import { useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import Avatar from '../components/Avatar'
import { findUser } from '../lib/api'
import { haptic } from '../lib/telegram'

/**
 * Вызвать конкретного игрока по нику (с "@" или без) или по tg_id —
 * ищем только среди тех, кто хоть раз открывал бота (найти можно и
 * прямо из рейтинга, см. LeaderboardScreen — там ник уже известен).
 */
export default function ChallengePickScreen({ onBack, onChallenge }) {
  const [query, setQuery] = useState('')
  const [state, setState] = useState({ status: 'idle', user: null })
  const [busy, setBusy] = useState(false)

  const search = async () => {
    const q = query.trim()
    if (!q || state.status === 'searching') return
    haptic.tap()
    setState({ status: 'searching', user: null })
    try {
      const { user } = await findUser(q)
      setState({ status: user ? 'found' : 'not_found', user })
    } catch {
      haptic.error()
      setState({ status: 'error', user: null })
    }
  }

  const challenge = async () => {
    if (busy || !state.user) return
    setBusy(true)
    try {
      await onChallenge(state.user.tg_id)
    } finally {
      setBusy(false)
    }
  }

  const name = state.user?.first_name || state.user?.username || 'Игрок'

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">Вызвать игрока</h1>
      </header>
      <p className="mt-1 text-sm text-tg-hint">По нику (с «@» или без) или по числовому Telegram ID</p>

      <div className="animate-rise mt-5 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Например, @nikita или 421512410"
          disabled={state.status === 'searching'}
          // text-[16px]: меньший размер провоцирует авто-зум при фокусе в мобильных WebView
          className="select-text min-w-0 flex-1 rounded-xl bg-tg-section px-3.5 py-3 text-[16px] text-tg-text outline-none placeholder:text-tg-hint disabled:opacity-60"
        />
        <button
          type="button"
          disabled={!query.trim() || state.status === 'searching'}
          onClick={search}
          className="shrink-0 rounded-xl bg-tg-accent px-4 py-3 text-[14px] font-semibold text-tg-accent-text disabled:opacity-50"
        >
          {state.status === 'searching' ? '…' : 'Найти'}
        </button>
      </div>

      {state.status === 'not_found' && (
        <p className="mt-4 text-center text-sm text-tg-hint">
          Такой игрок ещё не открывал бота.
        </p>
      )}
      {state.status === 'error' && (
        <p className="mt-4 text-center text-sm text-tg-danger">
          Не получилось найти, попробуйте ещё раз.
        </p>
      )}

      {state.status === 'found' && (
        <div className="animate-rise mt-5 flex items-center gap-3 rounded-2xl bg-tg-section p-3.5">
          <Avatar
            src={state.user.photo_url}
            avatarKey={state.user.avatar_key}
            frameKey={state.user.equipped_frame}
            name={name}
            size={44}
          />
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{name}</span>
          <button
            type="button"
            disabled={busy}
            onClick={challenge}
            className="shrink-0 rounded-xl bg-tg-accent px-4 py-2.5 text-[14px] font-semibold text-tg-accent-text disabled:opacity-50"
          >
            {busy ? '…' : '⚔️ Вызвать'}
          </button>
        </div>
      )}
    </Screen>
  )
}
