import { useEffect, useState } from 'react'
import { haptic } from '../lib/telegram'

/** Всплывающий тост при переходе на новый ранг по общему счёту. */
export default function RankUpToast({ rank }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!rank) return
    setVisible(true)
    haptic.success()
    const t = setTimeout(() => setVisible(false), 2600)
    return () => clearTimeout(t)
  }, [rank])

  if (!rank || !visible) return null

  return (
    <div className="animate-rise flex items-center gap-3 rounded-2xl border border-tg-accent/30 bg-glass-surface px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_20px_25px_-5px_rgba(0,0,0,0.4),0_8px_10px_-6px_rgba(0,0,0,0.4)] backdrop-blur-[22px] backdrop-saturate-150">
      <span className="text-2xl">{rank.icon}</span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-tg-accent">
          Новый ранг
        </p>
        <p className="text-[14px] font-semibold">{rank.name}</p>
      </div>
    </div>
  )
}
