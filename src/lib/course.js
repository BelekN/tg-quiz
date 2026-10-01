/**
 * Чистая логика урока мини-курса (без React) — собирает шаги дня из
 * ответа start_course_day, перемешивает варианты и т.п.
 *
 * Фазы: A — теория (переписки, карточки), B — закрепление (практика по
 * новому + повторение старого вперемешку + оценка карточек), C —
 * итоговый тест на последнем дне.
 */

export const PHASE_LABELS = {
  A: 'Фаза A · Теория',
  B: 'Фаза B · Закрепление',
  C: 'Итоговый тест',
}

export const RATINGS = [
  { key: 'forgot', icon: '😵', label: 'Забыл' },
  { key: 'hard', icon: '🤔', label: 'С трудом' },
  { key: 'easy', icon: '😎', label: 'Легко' },
]

const EXERCISE_TYPES = new Set(['binary', 'choice', 'spot', 'match'])

export const isExercise = (step) => EXERCISE_TYPES.has(step.type)

// Детерминированный от строки сид: одно и то же упражнение у одного
// игрока перемешано одинаково при каждом рендере (useMemo пересоздаётся
// при перезаходе в урок), но разные упражнения — по-разному.
function hashString(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededShuffle(items, seed) {
  const rand = mulberry32(hashString(String(seed)))
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Варианты в повторении авторски всегда стоят правильным первым —
 * перемешиваем, иначе ответ угадывался бы по позиции. answer
 * пересчитываем под новый порядок.
 */
export function prepareExercise(ex, seed) {
  if (ex.type === 'choice') {
    const order = seededShuffle(
      ex.options.map((_, i) => i),
      `${seed}:${ex.quote ?? ex.prompt}`,
    )
    return {
      ...ex,
      options: order.map((i) => ex.options[i]),
      answer: order.indexOf(ex.answer),
    }
  }
  if (ex.type === 'match') {
    return {
      ...ex,
      labels: seededShuffle(
        ex.pairs.map((p) => p.label),
        `${seed}:${ex.pairs.map((p) => p.quote).join('|')}`,
      ),
    }
  }
  return ex
}

/** Повторение — вперемешку с практикой: после каждых двух новых упражнений по одному старому. */
export function interleave(practice, review) {
  const out = []
  let r = 0
  practice.forEach((p, i) => {
    out.push(p)
    if (i % 2 === 1 && r < review.length) out.push(review[r++])
  })
  while (r < review.length) out.push(review[r++])
  return out
}

/**
 * Шаги урока по порядку. examOnly — пересдача: теорию и повторение
 * человек уже видел в этот же день, сразу к тесту.
 */
export function buildLessonSteps(lesson, { examOnly = false } = {}) {
  const seed = `${lesson.course_key}:${lesson.day}`
  const steps = []

  if (!examOnly) {
    for (const s of lesson.theory ?? []) steps.push({ ...s, phase: 'A' })

    const practice = interleave(lesson.practice ?? [], lesson.review ?? [])
    practice.forEach((ex, i) => steps.push({ ...prepareExercise(ex, `${seed}:${i}`), phase: 'B' }))

    // Оценивают и новое, и то, что сегодня повторяли — от этого зависит,
    // когда карточка вернётся. На последнем дне оценку заменяет тест.
    const rateCards = [...(lesson.new_cards ?? []), ...(lesson.review_cards ?? [])]
    if (!lesson.is_last && rateCards.length) {
      steps.push({ type: 'rating', phase: 'B', cards: rateCards })
    }
  }

  if (lesson.is_last && lesson.exam?.length) {
    steps.push({ type: 'exam', phase: 'C', questions: lesson.exam, passScore: lesson.pass_score })
  }

  return steps
}

/** Номер сертификата для показа: 7 -> «№ 000007». */
export function formatCertificateNo(no) {
  return `№ ${String(no ?? 0).padStart(6, '0')}`
}

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

/** '2026-10-02' -> '2 октября 2026' */
export function formatIssuedOn(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? '')
  if (!m) return ''
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`
}
