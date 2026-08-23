import { useEffect } from 'react'
import { mainButton, secondaryButton } from '../lib/telegram'

function useBottomButton(button, { text, onClick, disabled = false, loading = false, params }) {
  const active = Boolean(text && onClick)

  // текст/включённость/лоадер — реагируют на каждое изменение.
  // active может стать false, не размонтировавшись (например, когда
  // primaryAction зависит от какого-то условия) — прячем явно, а не
  // только в cleanup на анмаунт.
  useEffect(() => {
    if (!button.setParams.isAvailable()) return
    if (!active) {
      button.setParams({ isVisible: false })
      return
    }
    button.setParams({
      text,
      isVisible: true,
      isEnabled: !disabled,
      isLoaderVisible: loading,
      ...params,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, text, disabled, loading])

  // подписка на клик — отдельно, чтобы не дёргать её на каждый ре-рендер
  useEffect(() => {
    if (!active || !button.onClick.isAvailable()) return
    return button.onClick(onClick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, onClick])

  // прячем кнопку, когда экран, который её использовал, размонтировался
  useEffect(() => {
    return () => {
      if (button.setParams.isAvailable()) button.setParams({ isVisible: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/** Нативная MainButton Telegram вместо кастомной CTA-кнопки. */
export function useMainButton(options) {
  useBottomButton(mainButton, options)
}

/** Нативная SecondaryButton — вторичное действие рядом с MainButton. */
export function useSecondaryButton({ position = 'bottom', ...options }) {
  useBottomButton(secondaryButton, { ...options, params: { position } })
}
