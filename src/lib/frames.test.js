import { describe, expect, it } from 'vitest'
import { frameBackground, FRAME_META } from './frames'

describe('frameBackground', () => {
  it('resolves a known frame to a CSS background value', () => {
    expect(frameBackground('frame_gold')).toBe(FRAME_META.frame_gold.background)
    expect(frameBackground('frame_gold')).toMatch(/gradient/)
  })

  it('returns null for no frame / unknown frame', () => {
    expect(frameBackground(null)).toBeNull()
    expect(frameBackground(undefined)).toBeNull()
    expect(frameBackground('not_a_real_frame')).toBeNull()
  })
})
