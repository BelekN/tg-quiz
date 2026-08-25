import { resolveAvatarSrc } from '../lib/avatars'
import { frameBackground } from '../lib/frames'

export default function Avatar({ src, avatarKey, frameKey, name = '', size = 44, onClick }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const resolvedSrc = resolveAvatarSrc(avatarKey, src)
  const background = frameBackground(frameKey)

  const circle = (
    <div
      onClick={background ? undefined : onClick}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-tg-accent/25 font-semibold text-tg-text ${onClick && !background ? 'cursor-pointer active:scale-95' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={name}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        initial
      )}
    </div>
  )

  // Рамка — "бутерброд" из паддингов: внешний слой красится градиентом
  // косметики, внутренний — фоном приложения, получается кольцо любой
  // толщины без картинок и без спец-обработки под каждый стиль отдельно.
  if (!background) return circle

  return (
    <div
      onClick={onClick}
      className={`shrink-0 rounded-full p-[2.5px] ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
      style={{ background }}
    >
      <div className="rounded-full bg-tg-bg p-[1.5px]">{circle}</div>
    </div>
  )
}
