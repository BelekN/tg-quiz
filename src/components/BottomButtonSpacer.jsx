/**
 * Резерв места под нативной MainButton/SecondaryButton Telegram внизу
 * экрана — для контента длиннее одного экрана (см. useMainButton).
 *
 * Тот же приём, что у TabBarSpacer: НЕ через pb-* на <Screen>, у него
 * уже есть класс safe-bottom (правило в index.css, объявленное ПОСЛЕ
 * `@import "tailwindcss"`), которое при равной специфичности всегда
 * выигрывает в каскаде над любым pb-* на том же узле. Поэтому —
 * отдельный элемент в потоке на другом CSS-свойстве (height).
 *
 * h-20 — под высоту нативной кнопки, safe-bottom — под "домашнюю"
 * полосу снизу, как и у неё самой.
 */
export default function BottomButtonSpacer() {
  return <div className="safe-bottom h-20" aria-hidden="true" />
}
