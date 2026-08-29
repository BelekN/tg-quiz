import { useEffect, useState } from 'react'
import { haptic } from '../lib/telegram'

/** Всплывающий тост при разблокировке нового достижения (по одному, если их несколько). */
export default function AchievementToast({ achievements }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
    if (achievements?.length) haptic.success()
  }, [achievements])

  useEffect(() => {
    if (!achievements || index >= achievements.length) return
    const t = setTimeout(() => setIndex((i) => i + 1), 2600)
    return () => clearTimeout(t)
  }, [index, achievements])

  if (!achievements?.length || index >= achievements.length) return null
  const a = achievements[index]

  return (
    <div className="animate-rise flex items-center gap-3 rounded-2xl border border-quiz-gold/30 bg-glass-surface px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_20px_25px_-5px_rgba(0,0,0,0.4),0_8px_10px_-6px_rgba(0,0,0,0.4)] backdrop-blur-[22px] backdrop-saturate-150">
      <span className="text-2xl">{a.icon}</span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-quiz-gold">
          Новое достижение
        </p>
        <p className="text-[14px] font-semibold">{a.title}</p>
      </div>
    </div>
  )
}
