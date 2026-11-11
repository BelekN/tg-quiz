import { describe, expect, it } from 'vitest'
import bank from '../../supabase/pdd/questions.json'
import { SIGN_CODES, parseSign } from '../components/pdd/PddSign'
import { DEFAULT_EXAM_RULES } from './pdd'

/**
 * Проверка банка вопросов ПДД — опечатка в JSON (индекс ответа вне
 * вариантов, несуществующий знак, тема без вопросов) иначе всплыла бы
 * только у живого пользователя. Тот же подход, что courseContent.test.js.
 */
describe('pdd content', () => {
  const topicKeys = new Set(bank.topics.map((t) => t.key))

  it('topics are unique and each has questions', () => {
    expect(topicKeys.size).toBe(bank.topics.length)
    for (const t of bank.topics) {
      expect(t.title, t.key).toBeTruthy()
      expect(t.icon, t.key).toBeTruthy()
      expect(bank.questions.filter((q) => q.topic === t.key).length, t.key).toBeGreaterThanOrEqual(5)
    }
  })

  it('question ids are unique and stable-looking', () => {
    const ids = bank.questions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z]+-\d{2}$/)
  })

  it('every question is well-formed', () => {
    for (const q of bank.questions) {
      const ctx = q.id
      expect(topicKeys.has(q.topic), ctx).toBe(true)
      expect(q.question?.trim(), ctx).toBeTruthy()
      expect(q.explain?.trim(), ctx).toBeTruthy()
      expect(q.options.length, ctx).toBeGreaterThanOrEqual(2)
      expect(q.options.length, ctx).toBeLessThanOrEqual(4)
      expect(new Set(q.options).size, ctx).toBe(q.options.length)
      expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, ctx).toBe(true)
      if (q.sign) expect(SIGN_CODES, `${ctx}: знак ${q.sign}`).toContain(parseSign(q.sign).code)
    }
  })

  it('exam topics hold enough questions for one exam', () => {
    const examTopics = new Set(bank.topics.filter((t) => t.in_exam !== false).map((t) => t.key))
    const pool = bank.questions.filter((q) => examTopics.has(q.topic))
    expect(pool.length).toBeGreaterThanOrEqual(DEFAULT_EXAM_RULES.questions * 3)
  })
})
