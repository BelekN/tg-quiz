import { describe, expect, it } from 'vitest'
import course from '../../supabase/courses/logic-fallacies.json'

/**
 * Проверка самого контента курса — опечатка в JSON (неверный индекс
 * ответа, ссылка на несуществующую карточку, вариант с уловкой, которую
 * ещё не проходили) иначе всплыла бы только у живого пользователя.
 */
const titles = new Map(course.cards.map((c) => [c.title, c]))
// Короткие подписи в сопоставлении, где полное название не влезает в чип.
const ALIASES = { 'Бремя доказательства': 'Перекладывание бремени доказательства' }
const isHonest = (label) => /^Честн/.test(label)

function introDayOf(label) {
  const card = titles.get(ALIASES[label] ?? label)
  return card?.intro_day
}

function checkExercise(ex, maxDay, where) {
  const ctx = `${where}: ${ex.quote ?? ex.prompt}`
  switch (ex.type) {
    case 'binary':
      expect(typeof ex.trick, ctx).toBe('boolean')
      expect(ex.quote, ctx).toBeTruthy()
      expect(ex.explain, ctx).toBeTruthy()
      break
    case 'choice':
      expect(ex.options.length, ctx).toBeGreaterThanOrEqual(3)
      expect(new Set(ex.options).size, ctx).toBe(ex.options.length)
      expect(Number.isInteger(ex.answer) && ex.answer >= 0 && ex.answer < ex.options.length, ctx).toBe(true)
      expect(ex.explain, ctx).toBeTruthy()
      for (const o of ex.options) {
        if (isHonest(o)) continue
        expect(introDayOf(o), `${ctx} — «${o}» не карточка курса`).toBeDefined()
        expect(introDayOf(o), `${ctx} — «${o}» ещё не проходили`).toBeLessThanOrEqual(maxDay)
      }
      break
    case 'spot':
      expect(ex.messages.length, ctx).toBeGreaterThanOrEqual(2)
      expect(ex.answer >= 0 && ex.answer < ex.messages.length, ctx).toBe(true)
      expect(ex.explain, ctx).toBeTruthy()
      break
    case 'match': {
      const labels = ex.pairs.map((p) => p.label)
      expect(ex.pairs.length, ctx).toBeGreaterThanOrEqual(3)
      expect(new Set(labels).size, ctx).toBe(labels.length)
      for (const l of labels) {
        if (isHonest(l)) continue
        expect(introDayOf(l), `${ctx} — «${l}»`).toBeLessThanOrEqual(maxDay)
      }
      break
    }
    default:
      throw new Error(`${ctx}: неизвестный тип ${ex.type}`)
  }
}

describe(`курс «${course.title}»`, () => {
  it('has contiguous days, each new card introduced exactly once on its intro_day', () => {
    expect(course.days.map((d) => d.day)).toEqual(course.days.map((_, i) => i + 1))
    const seen = new Set()
    for (const d of course.days) {
      for (const key of d.cards) {
        const card = course.cards.find((c) => c.key === key)
        expect(card, key).toBeDefined()
        expect(card.intro_day, key).toBe(d.day)
        expect(seen.has(key), key).toBe(false)
        seen.add(key)
      }
    }
    expect(seen.size).toBe(course.cards.length)
    // карточки последнего дня некогда было бы повторить до теста
    for (const c of course.cards) expect(c.intro_day).toBeLessThan(course.days.length)
  })

  it('theory: every new card has a chat example with exactly one flagged line and a concept card', () => {
    for (const d of course.days) {
      for (const s of d.theory) {
        expect(['intro', 'chat', 'concept', 'tip']).toContain(s.type)
        if (s.type === 'chat') {
          expect(s.messages.filter((m) => m.flag), `${d.day}:${s.card}`).toHaveLength(1)
          expect(s.caption).toBeTruthy()
        }
        if (s.type === 'concept') {
          expect(s.signs.length).toBeGreaterThanOrEqual(2)
          expect(s.counter).toBeTruthy()
          expect(titles.get(s.title)?.key).toBe(s.card)
        }
      }
      for (const key of d.cards) {
        expect(d.theory.some((s) => s.type === 'chat' && s.card === key), `${d.day}: chat ${key}`).toBe(true)
        expect(d.theory.some((s) => s.type === 'concept' && s.card === key), `${d.day}: concept ${key}`).toBe(true)
      }
    }
  })

  it('practice only uses fallacies learned by that day', () => {
    for (const d of course.days) {
      for (const ex of d.practice) checkExercise(ex, d.day, `день ${d.day}`)
    }
  })

  it('review exercises only reference cards known by the first day they can come back', () => {
    for (const c of course.cards) {
      expect(c.review.length, c.key).toBeGreaterThanOrEqual(1)
      for (const ex of c.review) {
        expect(['binary', 'choice']).toContain(ex.type)
        checkExercise(ex, c.intro_day, `повторение ${c.key}`)
        if (ex.type === 'choice') expect(ex.options[ex.answer]).toBe(c.title)
      }
    }
  })

  it('exam tests every fallacy exactly once, answer indices are valid, pass score reachable', () => {
    expect(course.pass_score).toBeLessThanOrEqual(course.exam.length)
    const answered = course.exam.map((q) => {
      expect(q.options).toHaveLength(4)
      expect(q.answer >= 0 && q.answer < q.options.length, q.quote).toBe(true)
      expect(q.explain).toBeTruthy()
      for (const o of q.options) expect(titles.has(o), `${q.quote}: ${o}`).toBe(true)
      return q.options[q.answer]
    })
    expect(new Set(answered)).toEqual(new Set(course.cards.map((c) => c.title)))
  })

  it('fits the 3–5 minute budget', () => {
    // грубая оценка: ~15 с на шаг теории, ~15 с на упражнение,
    // плюс до 3 повторений и оценка карточек
    for (const d of course.days.slice(0, -1)) {
      const seconds = d.theory.length * 15 + (d.practice.length + 3) * 15 + 15
      expect(seconds, `день ${d.day}`).toBeLessThanOrEqual(5 * 60)
      expect(seconds, `день ${d.day}`).toBeGreaterThanOrEqual(3 * 60)
    }
  })
})
