import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import { Loader, ErrorView } from '../components/StateView'
import { fetchReferralStats } from '../lib/api'
import { haptic, shareReferralLink } from '../lib/telegram'

export default function ReferralScreen({ tgId, onBack }) {
  const [state, setState] = useState({ status: 'loading' })
  const [shared, setShared] = useState(false)

  useEffect(() => {
    let alive = true
    fetchReferralStats()
      .then((data) => {
        if (alive) setState({ status: 'ready', ...data })
      })
      .catch((e) => {
        if (alive) setState({ status: 'error', code: e.message })
      })
    return () => {
      alive = false
    }
  }, [])

  if (state.status === 'loading') return <Loader label="Загружаем…" />
  if (state.status === 'error') return <ErrorView code={state.code} onRetry={onBack} />

  const reward = state.coins_per_referral ?? 30

  const invite = () => {
    haptic.tap()
    shareReferralLink(
      tgId,
      '🎁 Присоединяйся к КвизДуэль по моей ссылке — получим монеты за приглашение!',
    )
    setShared(true)
  }

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">🎁 Пригласить друга</h1>
      </header>

      <div className="animate-rise mt-6 flex flex-col items-center gap-4 rounded-2xl border border-white/5 bg-tg-section p-5 text-center">
        <span className="text-4xl">🎁</span>
        <p className="text-[15px] font-semibold leading-snug">
          Ты и друг получите по {reward} монет, когда он откроет КвизДуэль по твоей ссылке
        </p>
        <button
          type="button"
          onClick={invite}
          className="w-full rounded-2xl bg-tg-accent px-4 py-3.5 text-[15px] font-bold text-tg-accent-text active:scale-[0.98]"
        >
          {shared ? '↗️  Отправить ещё раз' : '🎯  Отправить приглашение'}
        </button>
      </div>

      <div className="animate-rise mt-4 flex items-center justify-between rounded-2xl border border-white/5 bg-tg-section px-4 py-3.5">
        <span className="text-[13px] text-tg-hint">Приглашено друзей</span>
        <span className="text-[15px] font-bold tabular-nums">{state.invited_count ?? 0}</span>
      </div>
    </Screen>
  )
}
