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
    <div className="animate-rise flex items-center gap-3 rounded-2xl border border-tg-accent/30 bg-tg-section/95 px-4 py-3 shadow-xl backdrop-blur">
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
