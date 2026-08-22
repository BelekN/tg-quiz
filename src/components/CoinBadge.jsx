export default function CoinBadge({ value = 0 }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-quiz-gold/15 px-3 py-1.5">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-quiz-gold text-[11px] font-bold text-black">
        ₡
      </span>
      <span className="text-sm font-semibold tabular-nums text-quiz-gold">
        {value}
      </span>
    </div>
  )
}
