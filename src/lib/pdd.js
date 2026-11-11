/**
 * Чистая логика раздела «ПДД» (без React).
 *
 * В банке вопросов варианты хранятся в исходном порядке, и правильный
 * чаще всего стоит первым — поэтому показ ВСЕГДА перемешиваем на
 * клиенте, а для экзамена переводим выбранный индекс обратно в исходный
 * (сервер проверяет ответы в исходном порядке options).
 */

/** Правила экзамена по умолчанию — сервер присылает свои (pdd_exam_rules). */
export const DEFAULT_EXAM_RULES = { questions: 20, minutes: 25, max_errors: 2 }

/** Фишер–Йетс; rng подменяется в тестах. */
export function shuffled(arr, rng = Math.random) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Вопрос с перемешанными вариантами: order[i] — исходный индекс варианта,
 * показанного на месте i. answer (если есть — тренировка) пересчитан под
 * показанный порядок.
 */
export function shuffleQuestion(q, rng = Math.random) {
  const order = shuffled(
    q.options.map((_, i) => i),
    rng,
  )
  return {
    ...q,
    order,
    options: order.map((i) => q.options[i]),
    answer: q.answer === undefined ? undefined : order.indexOf(q.answer),
  }
}

/** Показанный индекс -> исходный; null/undefined (нет ответа) -> -1. */
export function toOriginalIndex(q, shownIndex) {
  if (shownIndex == null || shownIndex < 0) return -1
  return q.order?.[shownIndex] ?? -1
}

/** Исходный индекс -> показанный (для разбора экзамена). */
export function toShownIndex(q, originalIndex) {
  if (originalIndex == null || originalIndex < 0) return -1
  return q.order ? q.order.indexOf(originalIndex) : originalIndex
}

/** Сдан ли экзамен по правилам (для подсказок на клиенте; решает сервер). */
export function examPassed(correct, total, rules = DEFAULT_EXAM_RULES) {
  return total - correct <= rules.max_errors
}

/** 125_000 мс -> "2:05" */
export function formatClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** 1 -> "ошибка", 2 -> "ошибки", 5 -> "ошибок" */
export function pluralErrors(n) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'ошибка'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'ошибки'
  return 'ошибок'
}

/** 1 -> "вопрос", 2 -> "вопроса", 5 -> "вопросов" */
export function pluralQuestions(n) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'вопрос'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'вопроса'
  return 'вопросов'
}

/** 1 -> "попытка", 2 -> "попытки", 5 -> "попыток" */
export function pluralAttempts(n) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'попытка'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'попытки'
  return 'попыток'
}

/** Подпись под темой на экране раздела. */
export function topicStatus(t) {
  if (!t.attempts) return `${t.total} ${pluralQuestions(t.total)}`
  if (t.best_correct >= t.total) return `✅ Все ${t.total} без ошибок`
  return `Лучший результат: ${t.best_correct} из ${t.total}`
}
