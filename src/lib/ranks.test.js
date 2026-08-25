import { describe, expect, it } from 'vitest'
import { getRank, RANK_TIERS } from './ranks'

describe('getRank', () => {
  it('defaults null/undefined score to novice', () => {
    expect(getRank(null).key).toBe('novice')
    expect(getRank(undefined).key).toBe('novice')
  })

  it('picks the highest tier whose min is <= score', () => {
    expect(getRank(0).key).toBe('novice')
    expect(getRank(499).key).toBe('novice')
    expect(getRank(500).key).toBe('amateur')
    expect(getRank(1499).key).toBe('amateur')
    expect(getRank(1500).key).toBe('connoisseur')
  })

  it('reaches the top tier and reports no further progress', () => {
    const legend = getRank(28000)
    expect(legend.key).toBe('legend')
    expect(legend.next).toBeNull()
    expect(legend.progress).toBeNull()

    // score above the top threshold stays on the top tier, not out of bounds
    expect(getRank(999999).key).toBe('legend')
  })

  it('computes progress toward the next tier from the current tier floor', () => {
    const rank = getRank(600) // amateur (min 500), next connoisseur (min 1500)
    expect(rank.key).toBe('amateur')
    expect(rank.next.key).toBe('connoisseur')
    expect(rank.progress).toEqual({ current: 100, target: 1000 })
  })

  it('every tier is reachable and strictly increasing by min', () => {
    for (let i = 1; i < RANK_TIERS.length; i++) {
      expect(RANK_TIERS[i].min).toBeGreaterThan(RANK_TIERS[i - 1].min)
    }
  })
})
