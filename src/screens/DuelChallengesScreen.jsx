import { useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import Avatar from '../components/Avatar'
import { haptic } from '../lib/telegram'

/**
 * Все входящие вызовы разом — кнопка на Home всегда на виду (даже
 * когда вызовов нет), сам список — тут: вызвать могут и много раз
 * подряд, на главном экране это разрасталось бы карточкой.
 */
export default function DuelChallengesScreen({ challenges, onAccept, onDecline, onBack }) {
  const [busyId, setBusyId] = useState(null)

  const respond = async (fn, duelId) => {
    if (busyId) return
    haptic.tap()
    setBusyId(duelId)
    try {
      await fn(duelId)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">⚔️ Входящие вызовы</h1>
      </header>

      {challenges.length === 0 ? (
        <p className="mt-10 text-center text-sm text-tg-hint">
          Пока нет новых вызовов
        </p>
      ) : (
        <div className="animate-rise mt-5 flex flex-col gap-2">
          {challenges.map((c) => {
            const host = c.host
            const hostName = host?.first_name || host?.username || 'Игрок'
            const rowBusy = busyId === c.duel_id
            return (
              <div
                key={c.duel_id}
                className="flex items-center gap-3 rounded-2xl border border-white/5 bg-tg-section px-3 py-2.5"
              >
                <Avatar
                  src={host?.photo_url}
                  avatarKey={host?.avatar_key}
                  frameKey={host?.equipped_frame}
                  name={hostName}
                  size={40}
                />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{hostName}</span>
                <button
                  type="button"
                  disabled={rowBusy}
                  onClick={() => respond(onDecline, c.duel_id)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/5 text-base disabled:opacity-40"
                  aria-label={`Отклонить вызов от ${hostName}`}
                >
                  ✕
                </button>
                <button
                  type="button"
                  disabled={rowBusy}
                  onClick={() => respond(onAccept, c.duel_id)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tg-accent text-base text-tg-accent-text disabled:opacity-40"
                  aria-label={`Принять вызов от ${hostName}`}
                >
                  ✓
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Screen>
  )
}
