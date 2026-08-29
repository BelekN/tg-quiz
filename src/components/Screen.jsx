/**
 * Общая обёртка экрана: тёмный фон, безопасные зоны, мобильная ширина.
 *
 * relative isolate — без этого position:relative само по себе НЕ
 * создаёт контекст наложения: экран с абсолютным фоном на -z-10
 * (см. ProfileScreen) мог бы "убежать" выше по дереву и перекрыть
 * последующий контент этого же экрана вместо того, чтобы просто
 * остаться позади него. isolate гарантирует, что весь стэкинг
 * (в т.ч. отрицательный z-index) разрешается ВНУТРИ этого экрана,
 * не просачиваясь наружу и не пропуская наружное внутрь.
 */
export default function Screen({ children, className = '' }) {
  return (
    <div className="min-h-full bg-tg-bg text-tg-text">
      <div
        className={`safe-top safe-bottom relative isolate mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-6 pt-4 ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
