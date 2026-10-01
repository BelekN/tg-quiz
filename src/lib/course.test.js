import { describe, expect, it } from 'vitest'
import {
  buildLessonSteps,
  formatCertificateNo,
  formatIssuedOn,
  interleave,
  prepareExercise,
  seededShuffle,
} from './course'

describe('seededShuffle', () => {
  it('is a deterministic permutation for the same seed', () => {
    const items = [1, 2, 3, 4, 5, 6]
    const a = seededShuffle(items, 'seed')
    expect(seededShuffle(items, 'seed')).toEqual(a)
    expect([...a].sort()).toEqual(items)
    expect(items).toEqual([1, 2, 3, 4, 5, 6]) // не мутирует исходный
  })
})

describe('prepareExercise', () => {
  it('shuffles choice options but keeps the answer pointing at the same option', () => {
    const ex = { type: 'choice', quote: 'q', options: ['A', 'B', 'C', 'D'], answer: 0 }
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const out = prepareExercise(ex, seed)
      expect(out.options[out.answer]).toBe('A')
      expect([...out.options].sort()).toEqual(['A', 'B', 'C', 'D'])
    }
  })

  it('adds shuffled labels to match exercises', () => {
    const ex = { type: 'match', pairs: [{ quote: '1', label: 'x' }, { quote: '2', label: 'y' }] }
    expect(prepareExercise(ex, 's').labels.sort()).toEqual(['x', 'y'])
  })
})

describe('interleave', () => {
  it('puts one review item after every two practice items, leftovers at the end', () => {
    expect(interleave(['p1', 'p2', 'p3', 'p4'], ['r1', 'r2', 'r3'])).toEqual([
      'p1', 'p2', 'r1', 'p3', 'p4', 'r2', 'r3',
    ])
    expect(interleave([], ['r1'])).toEqual(['r1'])
  })
})

const lessonBase = {
  course_key: 'c',
  day: 2,
  total_days: 7,
  theory: [{ type: 'intro' }, { type: 'concept' }],
  practice: [{ type: 'binary', trick: true }],
  review: [{ type: 'binary', trick: false, is_review: true }],
  new_cards: [{ key: 'a', title: 'A' }],
  review_cards: [{ key: 'b', title: 'B' }],
  is_last: false,
  exam: null,
}

describe('buildLessonSteps', () => {
  it('orders a regular day as theory (A) -> practice+review (B) -> rating', () => {
    const steps = buildLessonSteps(lessonBase)
    expect(steps.map((s) => `${s.phase}:${s.type}`)).toEqual([
      'A:intro', 'A:concept', 'B:binary', 'B:binary', 'B:rating',
    ])
    expect(steps.at(-1).cards.map((c) => c.key)).toEqual(['a', 'b'])
  })

  it('ends the last day with the exam instead of a rating', () => {
    const steps = buildLessonSteps({
      ...lessonBase,
      is_last: true,
      exam: [{ id: 0, quote: 'q', options: ['x', 'y'] }],
      pass_score: 1,
    })
    expect(steps.at(-1)).toMatchObject({ type: 'exam', phase: 'C', passScore: 1 })
    expect(steps.some((s) => s.type === 'rating')).toBe(false)
  })

  it('examOnly skips straight to the exam (retake)', () => {
    const steps = buildLessonSteps(
      { ...lessonBase, is_last: true, exam: [{ id: 0, quote: 'q', options: ['x'] }] },
      { examOnly: true },
    )
    expect(steps.map((s) => s.type)).toEqual(['exam'])
  })
})

describe('certificate formatting', () => {
  it('pads the number and spells out the date in Russian', () => {
    expect(formatCertificateNo(7)).toBe('№ 000007')
    expect(formatIssuedOn('2026-10-02')).toBe('2 октября 2026')
    expect(formatIssuedOn(null)).toBe('')
  })
})
