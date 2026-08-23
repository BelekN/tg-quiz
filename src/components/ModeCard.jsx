/**
 * Плашка режима. soon=true -> некликабельна, с бейджем «Скоро».
 * disabled=true -> временно некликабельна (например, пока запускается
 * другой режим) без бейджа — просто чуть притушена.
 */
export default function ModeCard({ icon, title, subtitle, soon, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={soon || disabled}
      onClick={onClick}
      className={`relative flex w-full items-center gap-3.5 rounded-2xl border border-white/5 bg-tg-section px-4 py-4 text-left transition-transform ${
        soon || disabled ? 'opacity-45' : 'active:scale-[0.98]'
      }`}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tg-accent/15 text-xl">
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-xs text-tg-hint">{subtitle}</span>
      </span>
      {soon && (
        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-tg-hint">
          Скоро
        </span>
      )}
    </button>
  )
}
