import { describe, expect, it } from 'vitest'
import { parseDuelStartParam, parseCourseStartParam } from './api'

describe('parseDuelStartParam', () => {
  it('extracts the uuid out of a duel_<uuid> start param', () => {
    const uuid = '123e4567-e89b-42d3-a456-426614174000'
    expect(parseDuelStartParam(`duel_${uuid}`)).toBe(uuid)
  })

  it('returns null for anything that is not a well-formed duel start param', () => {
    expect(parseDuelStartParam(null)).toBeNull()
    expect(parseDuelStartParam(undefined)).toBeNull()
    expect(parseDuelStartParam('')).toBeNull()
    expect(parseDuelStartParam('not_a_duel_param')).toBeNull()
    expect(parseDuelStartParam('duel_not-a-real-uuid')).toBeNull()
  })
})

describe('parseCourseStartParam', () => {
  it('extracts the course key from course_<key>', () => {
    expect(parseCourseStartParam('course_logic-fallacies')).toBe('logic-fallacies')
  })

  it('rejects malformed params', () => {
    expect(parseCourseStartParam(null)).toBeNull()
    expect(parseCourseStartParam('course_')).toBeNull()
    expect(parseCourseStartParam('course_Bad Key')).toBeNull()
    expect(parseCourseStartParam('duel_logic')).toBeNull()
  })
})
