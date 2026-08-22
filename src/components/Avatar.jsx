export default function Avatar({ src, name = '', size = 44 }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-tg-accent/25 font-semibold text-tg-text"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {src ? (
        <img
          src={src}
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
