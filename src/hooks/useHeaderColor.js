import { useEffect } from 'react'
import { miniApp } from '../lib/telegram'

/**
 * Красит нативную шапку Telegram (там же, где "Close"/"←" и "•••") в
 * цвет верхней точки градиента экрана — на время жизни этого экрана,
 * возврат к обычному фону приложения при уходе с него.
 *
 * .supports.rgb() — не все клиенты Telegram умеют произвольный hex
 * (только 'bg_color'/'secondary_bg_color'); без поддержки просто
 * ничего не делаем, а не подсовываем неверный цвет.
 */
export function useHeaderColor(hex) {
  useEffect(() => {
    if (!miniApp.setHeaderColor.isAvailable() || !miniApp.setHeaderColor.supports.rgb()) return

    miniApp.setHeaderColor(hex)

    return () => {
      if (miniApp.setHeaderColor.isAvailable()) miniApp.setHeaderColor('bg_color')
    }
  }, [hex])
}
