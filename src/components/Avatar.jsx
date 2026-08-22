import { resolveAvatarSrc } from '../lib/avatars'

export default function Avatar({ src, avatarKey, name = '', size = 44, onClick }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const resolvedSrc = resolveAvatarSrc(avatarKey, src)

  return (
    <div
      onClick={onClick}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-tg-accent/25 font-semibold text-tg-text ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
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
}
