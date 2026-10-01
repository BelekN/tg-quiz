/**
 * Разделы вкладки «Учёба» и анонсы курсов «Скоро». Живые курсы приходят
 * с сервера с полем category (courses.category, 077_course_categories.sql)
 * и встают в свой раздел сами; анонсов в базе нет — когда курс готов,
 * его карточку отсюда убирают, а в supabase/courses/ добавляют .json.
 */
export const LEARN_CATEGORIES = [
  { key: 'thinking', icon: '🧠', title: 'Мышление', iconBg: 'bg-indigo-500/20' },
  { key: 'money', icon: '💰', title: 'Деньги', iconBg: 'bg-emerald-500/20' },
  { key: 'tech', icon: '🤖', title: 'Технологии', iconBg: 'bg-sky-500/20' },
  { key: 'people', icon: '🗣', title: 'Общение', iconBg: 'bg-pink-500/20' },
  { key: 'self', icon: '🌱', title: 'Саморазвитие', iconBg: 'bg-lime-500/20' },
]

export const UPCOMING_COURSES = [
  { category: 'thinking', icon: '🌀', title: 'Когнитивные искажения', subtitle: 'Почему мозг нас обманывает' },
  { category: 'thinking', icon: '🔎', title: 'Проверка фактов', subtitle: 'Как отличить новость от фейка за минуту' },
  { category: 'thinking', icon: '🧭', title: 'Принятие решений', subtitle: 'Выбирать спокойно, а не наугад' },
  { category: 'money', icon: '💸', title: 'Финансовая грамотность', subtitle: 'Бюджет, вклады, кредиты без боли' },
  { category: 'money', icon: '📈', title: 'Инвестиции с нуля', subtitle: 'Акции, облигации и риск — простыми словами' },
  { category: 'tech', icon: '✨', title: 'Основы ИИ', subtitle: 'Как устроены нейросети — простыми словами' },
  { category: 'tech', icon: '💡', title: 'Нейросети в работе', subtitle: 'Как просить ИИ так, чтобы он помог' },
  { category: 'tech', icon: '🔐', title: 'Цифровая безопасность', subtitle: 'Как не попасться мошенникам' },
  { category: 'people', icon: '🤝', title: 'Переговоры', subtitle: 'Договариваться и не уступать лишнего' },
  { category: 'people', icon: '🎤', title: 'Публичные выступления', subtitle: 'Говорить уверенно перед любой аудиторией' },
  { category: 'people', icon: '💬', title: 'Эмоциональный интеллект', subtitle: 'Понимать эмоции — свои и чужие' },
  { category: 'self', icon: '⏳', title: 'Продуктивность без выгорания', subtitle: 'Успевать главное и не сгореть' },
  { category: 'self', icon: '😴', title: 'Сон и энергия', subtitle: 'Высыпаться и держать силы весь день' },
]

/** Живые курсы + анонсы, разложенные по разделам в порядке LEARN_CATEGORIES; пустые разделы отбрасываются. */
export function groupLearnCatalog(courses, upcoming = UPCOMING_COURSES) {
  const known = new Set(LEARN_CATEGORIES.map((c) => c.key))
  return LEARN_CATEGORIES.map((cat) => ({
    ...cat,
    // курс с неизвестным разделом не теряем — кладём в первый
    courses: courses.filter((c) => (known.has(c.category) ? c.category : LEARN_CATEGORIES[0].key) === cat.key),
    upcoming: upcoming.filter((u) => u.category === cat.key),
  })).filter((g) => g.courses.length || g.upcoming.length)
}
