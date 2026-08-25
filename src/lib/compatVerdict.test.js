import { describe, expect, it } from 'vitest'
import { compatVerdict } from './compatVerdict'

describe('compatVerdict', () => {
  it('picks the tier by minimum threshold, highest first', () => {
    expect(compatVerdict(100).text).toMatch(/близнецы/)
    expect(compatVerdict(85).text).toMatch(/близнецы/)
    expect(compatVerdict(84).text).toMatch(/Отличная/)
    expect(compatVerdict(45).text).toMatch(/различия/)
    expect(compatVerdict(0).text).toMatch(/противоположности/)
  })

  it('always returns a tier, even for out-of-range input', () => {
    expect(compatVerdict(-5)).toBeTruthy()
    expect(compatVerdict(150).text).toMatch(/близнецы/)
  })
})
