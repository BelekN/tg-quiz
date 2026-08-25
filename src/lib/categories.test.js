import { describe, expect, it } from 'vitest'
import { categoryMeta } from './categories'

describe('categoryMeta', () => {
  it('resolves a known category', () => {
    expect(categoryMeta('geo')).toEqual({ icon: '🌍', label: 'География' })
  })

  it('falls back to a question-mark icon with the raw key as label for unknown categories', () => {
    expect(categoryMeta('nonexistent')).toEqual({ icon: '❓', label: 'nonexistent' })
  })
})
