import { useEffect, useRef, useState } from 'react'

/**
 * Таймер на вопрос. Считает по реальным часам (performance.now),
 * а не по числу тиков — поэтому не «плывёт», если браузер
 * подтормаживает или таб уходил в фон.
 *
 * @param duration  длительность, мс
 * @param resetKey  меняется -> таймер стартует заново (индекс вопроса)
 * @param active    false -> пауза (например, показываем результат ответа)
 * @param onExpire  колбэк на исчерпание времени
 */
export function useCountdown(duration, resetKey, active, onExpire) {
  const [remaining, setRemaining] = useState(duration)
  const expireRef = useRef(onExpire)
  expireRef.current = onExpire

  useEffect(() => {
    if (!active) return

    const startedAt = performance.now()
    let frame
    let fired = false
    setRemaining(duration)

    const tick = () => {
      const left = Math.max(0, duration - (performance.now() - startedAt))
      setRemaining(left)
      if (left <= 0) {
        if (!fired) {
          fired = true
          expireRef.current?.()
        }
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, active, duration])

  return { remaining, elapsed: duration - remaining }
}
