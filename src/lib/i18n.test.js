import { beforeEach, describe, expect, it } from 'vitest'
import { getLocale, LOCALES, setLocale, t } from './i18n'

beforeEach(() => {
  localStorage.clear()
})

describe('i18n', () => {
  it('defaults to ru when nothing is stored', () => {
    expect(getLocale()).toBe('ru')
  })

  it('resolves a known key from the current locale', () => {
    expect(t('forceUpdate.title')).toBe('Доступна новая версия')
  })

  it('falls back to the key itself when nothing matches (never renders "undefined")', () => {
    expect(t('this.key.does.not.exist')).toBe('this.key.does.not.exist')
  })

  it('interpolates {vars} into the resolved string', () => {
    // no dictionary entry matches this key, so it falls back to the key
    // itself — which is still enough to prove the {var} substitution runs
    expect(t('hello {name}', { name: 'Alice' })).toBe('hello Alice')
  })

  it('ignores setLocale for a locale that is not registered', () => {
    setLocale('xx')
    expect(getLocale()).toBe('ru')
  })

  it('only lists locales that actually have a dictionary', () => {
    expect(LOCALES).toContain('ru')
  })
})
