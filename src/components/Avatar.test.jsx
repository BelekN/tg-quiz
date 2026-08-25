import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import Avatar from './Avatar'

describe('Avatar', () => {
  it('renders a plain circle with no wrapping frame when frameKey is absent', () => {
    const { container } = render(<Avatar name="Dev" />)
    // единственный вложенный div — сама аватарка, без "бутерброда" рамки
    expect(container.querySelectorAll('div').length).toBe(1)
  })

  it('wraps the avatar in a gradient-background frame when frameKey resolves', () => {
    const { container } = render(<Avatar name="Dev" frameKey="frame_gold" />)
    const outer = container.firstChild
    expect(outer.style.background).toMatch(/gradient/)
    // рамка -> прослойка фона -> сам круг = 3 вложенных div
    expect(container.querySelectorAll('div').length).toBe(3)
  })

  it('ignores an unknown frameKey the same as no frame', () => {
    const { container } = render(<Avatar name="Dev" frameKey="not_a_real_frame" />)
    expect(container.querySelectorAll('div').length).toBe(1)
  })
})
