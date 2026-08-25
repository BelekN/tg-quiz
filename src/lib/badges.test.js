import { describe, expect, it } from 'vitest'
import { badgeLabel, BADGE_META } from './badges'

describe('badgeLabel', () => {
  it('resolves a known badge to its display label', () => {
    expect(badgeLabel('badge_legend')).toBe(BADGE_META.badge_legend.label)
    expect(badgeLabel('badge_legend')).toMatch(/Легенда/)
  })

  it('returns null for no badge / unknown badge', () => {
    expect(badgeLabel(null)).toBeNull()
    expect(badgeLabel(undefined)).toBeNull()
    expect(badgeLabel('not_a_real_badge')).toBeNull()
  })
})
