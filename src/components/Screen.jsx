/** Общая обёртка экрана: тёмный фон, безопасные зоны, мобильная ширина. */
export default function Screen({ children, className = '' }) {
  return (
    <div className="min-h-full bg-tg-bg text-tg-text">
      <div
        className={`safe-top safe-bottom mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-6 pt-4 ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
