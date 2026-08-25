import { describe, expect, it } from 'vitest'
import { computePersonaResult } from './persona'

describe('computePersonaResult — categorical', () => {
  it('picks the most frequent result_key', () => {
    const answers = [{ result_key: 'fox' }, { result_key: 'owl' }, { result_key: 'fox' }]
    expect(computePersonaResult('categorical', answers, [])).toBe('fox')
  })

  it('breaks ties by whichever key was seen first', () => {
    const answers = [{ result_key: 'fox' }, { result_key: 'owl' }]
    expect(computePersonaResult('categorical', answers, [])).toBe('fox')
  })

  it('ignores answers without a result_key', () => {
    const answers = [{}, { result_key: 'fox' }]
    expect(computePersonaResult('categorical', answers, [])).toBe('fox')
  })

  it('returns null when nothing scored', () => {
    expect(computePersonaResult('categorical', [], [])).toBeNull()
  })
})

describe('computePersonaResult — scale', () => {
  const results = [
    { key: 'low', min_score: 0, max_score: 1 },
    { key: 'high', min_score: 2, max_score: 3 },
  ]

  it('sums answer values and buckets into the matching range', () => {
    expect(computePersonaResult('scale', [{ value: 0 }, { value: 1 }], results)).toBe('low')
    expect(computePersonaResult('scale', [{ value: 2 }, { value: 1 }], results)).toBe('high')
  })

  it('treats missing value as 0', () => {
    expect(computePersonaResult('scale', [{}, {}], results)).toBe('low')
  })

  it('falls back to the last result when the total is out of every range', () => {
    expect(computePersonaResult('scale', [{ value: 99 }], results)).toBe('high')
  })
})
