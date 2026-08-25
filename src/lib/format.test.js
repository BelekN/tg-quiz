import { describe, expect, it } from 'vitest'
import { formatNumber, pluralDays } from './format'

describe('formatNumber', () => {
  it('inserts a thousands separator', () => {
    // Intl.NumberFormat('ru-RU') uses a non-breaking space ( )
    expect(formatNumber(12500)).toBe('12 500')
    expect(formatNumber(1000000)).toBe('1 000 000')
  })

  it('leaves small numbers untouched', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(42)).toBe('42')
  })

  it('passes through non-numeric values unchanged (e.g. "8/10" accuracy fractions)', () => {
    expect(formatNumber('8/10')).toBe('8/10')
  })

  it('falls back to 0 for null/undefined', () => {
    expect(formatNumber(null)).toBe(0)
    expect(formatNumber(undefined)).toBe(0)
  })

  it('does not choke on NaN', () => {
    expect(formatNumber(NaN)).toBe(0)
  })
})

describe('pluralDays', () => {
  it('picks "день" for 1, 21, 31...', () => {
    expect(pluralDays(1)).toBe('день')
    expect(pluralDays(21)).toBe('день')
  })

  it('picks "дня" for 2-4, 22-24...', () => {
    expect(pluralDays(2)).toBe('дня')
    expect(pluralDays(3)).toBe('дня')
    expect(pluralDays(4)).toBe('дня')
    expect(pluralDays(22)).toBe('дня')
  })

  it('picks "дней" for 0, 5-20, 25...', () => {
    expect(pluralDays(0)).toBe('дней')
    expect(pluralDays(5)).toBe('дней')
    expect(pluralDays(11)).toBe('дней')
    expect(pluralDays(12)).toBe('дней')
    expect(pluralDays(25)).toBe('дней')
  })
})
