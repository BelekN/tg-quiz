import { describe, expect, it } from 'vitest'
import {
  examPassed,
  formatClock,
  pluralAttempts,
  pluralErrors,
  shuffleQuestion,
  shuffled,
  toOriginalIndex,
  toShownIndex,
  topicStatus,
} from './pdd'

// Детерминированный rng для тестов.
function seq(...values) {
  let i = 0
  return () => values[i++ % values.length]
}

describe('pdd', () => {
  it('shuffled keeps all elements and does not mutate the input', () => {
    const src = [1, 2, 3, 4]
    const out = shuffled(src, seq(0.1, 0.9, 0.5))
    expect(out.sort()).toEqual([1, 2, 3, 4])
    expect(src).toEqual([1, 2, 3, 4])
  })

  it('shuffleQuestion remaps the answer and round-trips indices', () => {
    const q = { id: 'x', options: ['A', 'B', 'C', 'D'], answer: 0 }
    for (const rng of [seq(0), seq(0.99), seq(0.3, 0.7, 0.1), Math.random]) {
      const s = shuffleQuestion(q, rng)
      expect(s.options[s.answer]).toBe('A')
      for (let shown = 0; shown < 4; shown++) {
        const orig = toOriginalIndex(s, shown)
        expect(q.options[orig]).toBe(s.options[shown])
        expect(toShownIndex(s, orig)).toBe(shown)
      }
    }
  })

  it('correct answer is not always first after shuffling', () => {
    const q = { options: ['A', 'B', 'C', 'D'], answer: 0 }
    const positions = new Set(Array.from({ length: 200 }, () => shuffleQuestion(q).answer))
    expect(positions.size).toBeGreaterThan(1)
  })

  it('exam question without answer stays without answer; no pick maps to -1', () => {
    const s = shuffleQuestion({ options: ['A', 'B'] })
    expect(s.answer).toBeUndefined()
    expect(toOriginalIndex(s, null)).toBe(-1)
    expect(toOriginalIndex(s, -1)).toBe(-1)
  })

  it('examPassed allows at most max_errors', () => {
    const rules = { questions: 20, minutes: 25, max_errors: 2 }
    expect(examPassed(18, 20, rules)).toBe(true)
    expect(examPassed(17, 20, rules)).toBe(false)
  })

  it('formats clock and plurals', () => {
    expect(formatClock(25 * 60 * 1000)).toBe('25:00')
    expect(formatClock(65_001)).toBe('1:06')
    expect(formatClock(-5)).toBe('0:00')
    expect(pluralErrors(1)).toBe('ошибка')
    expect(pluralErrors(3)).toBe('ошибки')
    expect(pluralErrors(11)).toBe('ошибок')
    expect(pluralAttempts(1)).toBe('попытка')
    expect(pluralAttempts(22)).toBe('попытки')
  })

  it('topicStatus', () => {
    expect(topicStatus({ total: 10, attempts: 0, best_correct: 0 })).toBe('10 вопросов')
    expect(topicStatus({ total: 10, attempts: 2, best_correct: 10 })).toMatch(/без ошибок/)
    expect(topicStatus({ total: 10, attempts: 1, best_correct: 7 })).toBe('Лучший результат: 7 из 10')
  })
})
