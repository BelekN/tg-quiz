import { useEffect } from 'react'
import { backButton } from '../lib/telegram'

/**
 * Показывает нативную BackButton Telegram (в шапке) на время жизни
 * экрана, в дополнение к нашей кастомной "←" — на клиентах без
 * поддержки (или в браузере при VITE_DEV_MOCK) просто ничего не делает.
 */
export function useBackButton(onBack) {
  useEffect(() => {
    if (!onBack || !backButton.show.isAvailable()) return

    backButton.show()
    const off = backButton.onClick.isAvailable() ? backButton.onClick(onBack) : undefined

    return () => {
      off?.()
      if (backButton.hide.isAvailable()) backButton.hide()
    }
  }, [onBack])
}
