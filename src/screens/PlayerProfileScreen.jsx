import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import Avatar from '../components/Avatar'
import { Loader, ErrorView } from '../components/StateView'
import { fetchPlayerProfile } from '../lib/api'
import { formatNumber, pluralDays } from '../lib/format'
import { badgeLabel } from '../lib/badges'

/** Публичный профиль другого игрока — статистика, разблокированные награды, личный счёт. */
export default function PlayerProfileScreen({ tgId, onBack }) {
  const [state, setState] = useState({ status: 'loading', profile: null })

  useEffect(() => {
    let alive = true
    setState({ status: 'loading', profile: null })
    fetchPlayerProfile(tgId)
      .then((profile) => {
        if (alive) setState({ status: 'ready', profile })
      })
      .catch((e) => {
        if (alive) setState({ status: 'error', code: e.message, profile: null })
      })
    return () => {
      alive = false
    }
  }, [tgId])

  if (state.status === 'loading') return <Loader label="Загружаем профиль…" />
  if (state.status === 'error') return <ErrorView code={state.code} onRetry={onBack} />

  const p = state.profile
  const name = p.first_name || p.username || 'Игрок'
  const vsMe = p.vs_me

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
      </header>

      <div className="animate-rise mt-2 flex flex-col items-center text-center">
        <Avatar
          src={p.photo_url}
          avatarKey={p.avatar_key}
          frameKey={p.equipped_frame}
          name={name}
          size={84}
        />
        <p className="mt-3 text-xl font-bold">{name}</p>
        {badgeLabel(p.equipped_badge) && (
          <p className="mt-0.5 text-[13px] font-medium text-tg-accent">{badgeLabel(p.equipped_badge)}</p>
        )}
        {p.city && <p className="mt-0.5 text-xs text-tg-hint">{p.city}</p>}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/5 bg-tg-section px-4 py-3">
          <p className="text-[11px] text-tg-hint">Всего очков</p>
          <p className="text-2xl font-bold tabular-nums">{formatNumber(p.total_score)}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-tg-section px-4 py-3">
          <p className="text-[11px] text-tg-hint">За неделю</p>
          <p className="text-2xl font-bold tabular-nums">{formatNumber(p.weekly_score)}</p>
        </div>
      </div>

      {p.current_streak > 1 && (
        <p className="mt-3 px-1 text-sm text-tg-hint">
          🔥 {p.current_streak} {pluralDays(p.current_streak)} подряд сейчас
          {p.longest_streak > p.current_streak && ` · рекорд ${p.longest_streak}`}
        </p>
      )}

      {vsMe && vsMe.games > 0 && (
        <div className="animate-rise mt-5 flex items-center justify-between rounded-2xl bg-tg-accent/10 px-4 py-3.5">
          <div>
            <p className="text-[13px] font-semibold">Личный счёт</p>
            <p className="text-xs text-tg-hint">
              {vsMe.games} {vsMe.games === 1 ? 'дуэль' : 'дуэлей'}
              {vsMe.draws > 0 ? ` · ${vsMe.draws} вничью` : ''}
            </p>
          </div>
          <p className="text-xl font-bold tabular-nums">{vsMe.wins}:{vsMe.losses}</p>
        </div>
      )}

      {p.achievements.length > 0 && (
        <section className="animate-rise mt-6">
          <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
            Награды ({p.achievements.length})
          </p>
          <div className="grid grid-cols-3 gap-y-4">
            {p.achievements.map((a) => (
              <div key={a.key} className="flex flex-col items-center gap-1.5 px-1 text-center">
                <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-quiz-gold/50 bg-quiz-gold/10 text-3xl">
                  {a.icon}
                </span>
                <span className="line-clamp-2 text-[11px] font-medium leading-tight">{a.title}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </Screen>
  )
}
