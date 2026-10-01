import { describe, expect, it } from 'vitest'
import { LEARN_CATEGORIES, UPCOMING_COURSES, groupLearnCatalog } from './learnCatalog'

describe('learnCatalog', () => {
  it('every upcoming course belongs to a known section and titles are unique', () => {
    const keys = new Set(LEARN_CATEGORIES.map((c) => c.key))
    for (const u of UPCOMING_COURSES) expect(keys.has(u.category), u.title).toBe(true)
    expect(new Set(UPCOMING_COURSES.map((u) => u.title)).size).toBe(UPCOMING_COURSES.length)
  })

  it('groups live courses into sections, unknown category falls into the first one', () => {
    const groups = groupLearnCatalog(
      [{ key: 'a', category: 'money' }, { key: 'b', category: 'nope' }],
      [{ category: 'people', title: 'x' }],
    )
    expect(groups.map((g) => g.key)).toEqual(['thinking', 'money', 'people'])
    expect(groups[0].courses.map((c) => c.key)).toEqual(['b'])
    expect(groups[1].courses.map((c) => c.key)).toEqual(['a'])
  })
})
