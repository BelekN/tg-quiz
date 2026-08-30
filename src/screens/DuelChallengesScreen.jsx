import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import Avatar from '../components/Avatar'
import { fetchSentDuelChallenges } from '../lib/api'
import { formatNumber } from '../lib/format'
import { haptic } from '../lib/telegram'

const dateFormatter = new Intl.DateTimeFormat('ru', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Одна лента событий вокруг вызовов на дуэль — как лента активности в
 * Instagram (приглашения на подписку вперемешку с другими событиями,
 * одним списком по времени, а не разложено по вкладкам): кто вызвал
 * меня (можно ответить прямо тут) и кого вызвал я сам (статус — ждёт
 * ответа/отклонил/играет/уже сыграно со счётом), в одном хронологическом
 * списке. Задел на будущее — сюда же лягут другие типы событий, если
 * появятся, без переделки экрана.
 */
export default function DuelChallengesScreen({ challenges, onAccept, onDecline, onBack, onOpenProfile }) {
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

  const events = [
    ...challenges.map((c) => ({ kind: 'incoming', duel_id: c.duel_id, created_at: c.created_at, person: c.host })),
    ...sent.items.map((c) => ({
      kind: 'outgoing',
      duel_id: c.duel_id,
      created_at: c.created_at,
      status: c.status,
      host_score: c.host_score,
      guest_score: c.guest_score,
      person: c.target,
    })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">⚔️ Вызовы</h1>
      </header>

      {sent.status === 'error' && (
        <p className="mt-4 text-center text-sm text-tg-danger">
          Не получилось загрузить исходящие, попробуйте ещё раз
        </p>
      )}

      {sent.status !== 'loading' && events.length === 0 ? (
        <p className="mt-10 text-center text-sm text-tg-hint">
          Пока нет ни одного вызова — ни входящих, ни исходящих
        </p>
      ) : (
        <div className="animate-rise mt-5 flex flex-col gap-2">
          {events.map((e) => (
            <EventRow
              key={e.duel_id}
              event={e}
              busy={busyId === e.duel_id}
              onAccept={() => respond(onAccept, e.duel_id)}
              onDecline={() => respond(onDecline, e.duel_id)}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </div>
      )}
    </Screen>
  )
}

function EventRow({ event, busy, onAccept, onDecline, onOpenProfile }) {
  const name = event.person?.first_name || event.person?.username || 'Игрок'
  const when = dateFormatter.format(new Date(event.created_at))

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-tg-section px-3.5 py-3">
      <button
        type="button"
        onClick={() => onOpenProfile?.(event.person?.tg_id)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Avatar
          src={event.person?.photo_url}
          avatarKey={event.person?.avatar_key}
          frameKey={event.person?.equipped_frame}
          name={name}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium">
            <span className="font-semibold">{name}</span> {eventText(event)}
          </p>
          <p className="text-xs text-tg-hint">{when}</p>
        </div>
      </button>

      {event.kind === 'incoming' ? (
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-base disabled:opacity-40"
            aria-label={`Отклонить вызов от ${name}`}
          >
            ✕
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="grid h-9 w-9 place-items-center rounded-full bg-tg-accent text-base text-tg-accent-text disabled:opacity-40"
            aria-label={`Принять вызов от ${name}`}
          >
            ✓
          </button>
        </div>
      ) : (
        <div className="shrink-0 text-right">
          {event.status === 'completed' ? (
            <>
              <p className="text-[15px] font-bold tabular-nums">
                {formatNumber(event.host_score)} : {formatNumber(event.guest_score)}
              </p>
              <p className={`text-xs font-semibold ${outcomeBadge(event).className}`}>
                {outcomeBadge(event).label}
              </p>
            </>
          ) : (
            <p className={`text-[13px] font-bold ${statusBadge(event.status).className}`}>
              {statusBadge(event.status).label}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function eventText(event) {
  if (event.kind === 'incoming') return 'вызывает тебя на дуэль'
  if (event.status === 'completed') return '— дуэль сыграна'
  return 'вызван(а) на дуэль'
}

function statusBadge(status) {
  if (status === 'invited') return { label: 'Ждёт ответа', className: 'text-tg-hint' }
  if (status === 'declined') return { label: 'Отклонил(а)', className: 'text-tg-hint' }
  return { label: 'Играет', className: 'text-tg-accent' } // pending
}

// host_score/guest_score — я/цель, я всегда хост в адресном вызове
function outcomeBadge(event) {
  if (event.host_score > event.guest_score) return { label: 'Победа', className: 'text-quiz-right' }
  if (event.host_score < event.guest_score) return { label: 'Поражение', className: 'text-quiz-wrong' }
  return { label: 'Ничья', className: 'text-tg-hint' }
}
