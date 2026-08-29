import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import CompatBreakdown from '../components/CompatBreakdown'
import { fetchCompatProgress, fetchCompatDetail } from '../lib/api'
import { haptic, shareCompatLink } from '../lib/telegram'
import { compatVerdict } from '../lib/compatVerdict'

const POLL_MS = 4000

/**
 * Хост зовёт партнёра ТОЛЬКО отсюда, после того как сам ответил на
 * все вопросы — тот же порядок, что у дуэли (там тоже сначала играешь
 * сам, зовёшь — с экрана результата). Пока ждём — поллим, как в
 * ResultScreen с дуэлью, вместо форсированного выхода-входа.
 */
export default function CompatResultScreen({ sessionId, role, title, initial, onHome, onPlayAgain }) {
  const [state, setState] = useState(initial)
  const [shared, setShared] = useState(false)
  const [detail, setDetail] = useState(null)

  const completed = state.session_completed ?? state.completed ?? false
  const matchPercent = state.match_percent

  // Постатейная разбивка грузится отдельно и лениво — доступна только
  // когда сессия уже завершена (см. get_compat_detail), поэтому нет
  // смысла запрашивать её раньше.
  useEffect(() => {
    if (!completed) return
    let alive = true
    fetchCompatDetail(sessionId)
      .then((res) => {
        if (alive) setDetail(res)
      })
      .catch(() => {}) // необязательное дополнение — молча пропускаем
    return () => {
      alive = false
    }
  }, [completed, sessionId])

  useEffect(() => {
    if (completed) return
    let alive = true

    const tick = () => {
      fetchCompatProgress(sessionId)
        .then((progress) => {
          if (alive) setState(progress)
        })
        .catch(() => {}) // сеть моргнула — попробуем на следующем тике
    }
    tick()
    const id = setInterval(tick, POLL_MS)

    return () => {
      alive = false
      clearInterval(id)
    }
  }, [completed, sessionId])

  const invite = () => {
    haptic.tap()
    shareCompatLink(sessionId, `Пройди со мной тест «${title}» — узнаем % совпадения! 💞`)
    setShared(true)
  }

  if (completed) {
    const verdict = compatVerdict(matchPercent)
    return (
      <Screen className="items-center justify-center text-center">
        <div className="text-5xl">{verdict.emoji}</div>
        <h1 className="animate-rise mt-4 text-2xl font-bold">{matchPercent}% совпадения</h1>
        <p className="mt-2 max-w-xs text-sm text-tg-hint">{verdict.text}</p>

        {detail && (
          <div className="animate-rise mt-6 w-full max-w-xs">
            <CompatBreakdown items={detail.items} />
          </div>
        )}

        <button
          type="button"
          onClick={onPlayAgain}
          className="mt-8 w-full max-w-xs rounded-2xl bg-tg-accent px-6 py-3.5 text-[15px] font-semibold text-tg-accent-text active:scale-[0.98]"
        >
          Пройти другой тест
        </button>
        <button
          type="button"
          onClick={onHome}
          className="mt-2.5 mb-6 w-full max-w-xs rounded-2xl bg-tg-surface px-6 py-3.5 text-[15px] font-semibold text-tg-text active:scale-[0.98]"
        >
          На главную
        </button>
      </Screen>
    )
  }

  const guestJoined = state.guest_joined
  const waitingForInvite = role === 'host' && !guestJoined

  return (
    <Screen className="items-center justify-center text-center">
      <div className="text-5xl">⏳</div>
      <h1 className="animate-rise mt-4 text-xl font-bold">
        {waitingForInvite ? 'Позови партнёра' : 'Ждём, когда партнёр ответит'}
      </h1>
      <p className="mt-2 max-w-xs text-sm text-tg-hint">
        {waitingForInvite
          ? 'Твои ответы уже сохранены — отправь ссылку, и как только партнёр пройдёт тест, увидите % совпадения.'
          : 'Твои ответы сохранены, результат появится сразу, как только партнёр закончит.'}
      </p>
      {role === 'host' && (
        <button
          type="button"
          onClick={invite}
          className="mt-6 w-full max-w-xs rounded-2xl bg-tg-accent px-6 py-3.5 text-[15px] font-semibold text-tg-accent-text active:scale-[0.98]"
        >
          {shared ? '↗️ Отправить ещё раз' : '💞 Позвать партнёра'}
        </button>
      )}
      <button
        type="button"
        onClick={onHome}
        className="mt-2.5 w-full max-w-xs rounded-2xl bg-tg-surface px-6 py-3.5 text-[15px] font-semibold text-tg-text active:scale-[0.98]"
      >
        На главную
      </button>
    </Screen>
  )
}
