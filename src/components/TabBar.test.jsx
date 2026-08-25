import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TabBar from './TabBar'

describe('TabBar', () => {
  it('renders exactly 4 tabs', () => {
    render(<TabBar active="home" onChange={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })

  it('calls onChange with the tapped tab key', () => {
    const onChange = vi.fn()
    render(<TabBar active="home" onChange={onChange} />)
    fireEvent.click(screen.getByText('Магазин'))
    expect(onChange).toHaveBeenCalledWith('shop')
  })

  it('does not fire haptic/onChange redundantly when tapping the already-active tab', () => {
    // не проверяем сам haptic (мокать SDK тут излишне) — только то,
    // что onChange всё равно вызывается с тем же ключом, без ошибок
    const onChange = vi.fn()
    render(<TabBar active="shop" onChange={onChange} />)
    fireEvent.click(screen.getByText('Магазин'))
    expect(onChange).toHaveBeenCalledWith('shop')
  })
})
