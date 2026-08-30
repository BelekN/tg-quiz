import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import Avatar from '../components/Avatar'
import { fetchSentDuelChallenges } from '../lib/api'
import { haptic } from '../lib/telegram'

/**
 * Входящие (кто вызвал меня) и исходящие (кого вызвал я) вызовы разом —
 * кнопка на Home всегда на виду (даже когда вызовов нет), сам список —
 * тут: вызвать могут и много раз подряд, на главном экране это
 * разрасталось бы карточкой. Исходящие заодно показывают, кто ответил
 * (принял/отклонил), а кто ещё нет, и чем закончились уже сыгранные —
 * без похода в отдельную "Историю игр".
 */
export default function DuelChallengesScreen({ challenges, onAccept, onDecline, onBack }) {
  const [tab, setTab] = useState('incoming')
  const [sent, setSent] = useState({ status: 'loading', items: [] })
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    let alive = true
    fetchSentDuelChallenges()
      .then(({ items }) => {
        if (alive) setSent({ status: 'ready', items: items ?? [] })
      })
      .catch((e) => {
        if (alive) setSent({ status: 'error', code: e.message, items: [] })
      })
    return () => {
      alive = false
    }
  }, [])

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
        <h1 className="text-lg font-bold">⚔️ Вызовы</h1>
      </header>

      <div className="animate-rise mt-4 flex gap-1 rounded-2xl bg-tg-section p-1">
        {[
          { key: 'incoming', label: `Входящие${challenges.length ? ` (${challenges.length})` : ''}` },
          { key: 'outgoing', label: 'Исходящие' },
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

      {tab === 'incoming' ? (
        challenges.length === 0 ? (
          <p className="mt-10 text-center text-sm text-tg-hint">
            Пока нет новых вызовов
          </p>
        ) : (
          <div className="animate-rise mt-4 flex flex-col gap-2">
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
        )
      ) : sent.status === 'loading' ? (
        <p className="mt-10 text-center text-sm text-tg-hint">Загружаем…</p>
      ) : sent.status === 'error' ? (
        <p className="mt-10 text-center text-sm text-tg-danger">Не получилось загрузить, попробуйте ещё раз</p>
      ) : sent.items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-tg-hint">Вы ещё никого не вызывали</p>
      ) : (
        <div className="animate-rise mt-4 flex flex-col gap-2">
          {sent.items.map((c) => {
            const target = c.target
            const targetName = target?.first_name || target?.username || 'Игрок'
            const outcome = sentOutcome(c)
            return (
              <div
                key={c.duel_id}
                className="flex items-center gap-3 rounded-2xl border border-white/5 bg-tg-section px-3 py-2.5"
              >
                <Avatar
                  src={target?.photo_url}
                  avatarKey={target?.avatar_key}
                  frameKey={target?.equipped_frame}
                  name={targetName}
                  size={40}
                />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{targetName}</span>
                <span className={`shrink-0 text-[13px] font-bold ${outcome.className}`}>{outcome.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </Screen>
  )
}

function sentOutcome(c) {
  if (c.status === 'invited') return { label: 'Ждёт ответа', className: 'text-tg-hint' }
  if (c.status === 'declined') return { label: 'Отклонил(а)', className: 'text-tg-hint' }
  if (c.status === 'pending') return { label: 'Играет', className: 'text-tg-accent' }
  // completed — host_score/guest_score это я/цель, я всегда хост в адресном вызове
  if (c.host_score > c.guest_score) return { label: `Победа ${c.host_score}:${c.guest_score}`, className: 'text-quiz-right' }
  if (c.host_score < c.guest_score) return { label: `Проигрыш ${c.host_score}:${c.guest_score}`, className: 'text-quiz-wrong' }
  return { label: `Ничья ${c.host_score}:${c.guest_score}`, className: 'text-tg-hint' }
}
