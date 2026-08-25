import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BackButton from './BackButton'

// Раньше каждый экран одновременно показывал нативную BackButton
// Telegram И свою "←" — регрессия на "две кнопки назад". Мокаем SDK,
// чтобы проверить оба режима: нативная доступна (Telegram) / недоступна
// (браузер, VITE_DEV_MOCK).
const state = { available: false }

vi.mock('../lib/telegram', () => ({
  backButton: {
    show: Object.assign(vi.fn(), { isAvailable: () => state.available }),
    hide: Object.assign(vi.fn(), { isAvailable: () => state.available }),
    onClick: Object.assign(vi.fn(() => () => {}), { isAvailable: () => state.available }),
  },
}))

describe('BackButton', () => {
  it('renders nothing when no onBack is given', () => {
    state.available = false
    const { container } = render(<BackButton onBack={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a visible "←" fallback when the native Telegram button is unavailable', () => {
    state.available = false
    const onBack = vi.fn()
    render(<BackButton onBack={onBack} />)

    const button = screen.getByRole('button', { name: 'Назад' })
    expect(button).toBeInTheDocument()
    fireEvent.click(button)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when the native Telegram button is available (avoids showing two back buttons)', () => {
    state.available = true
    const { container } = render(<BackButton onBack={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
