/**
 * Дружеская подпись к % совпадения в тесте на совместимость — чистая
 * витрина, сервер отдаёт только сам процент (см. answer_compat).
 */
const TIERS = [
  { min: 85, emoji: '🔥', text: 'Практически близнецы по духу!' },
  { min: 65, emoji: '💞', text: 'Отличная совместимость — много общего.' },
  { min: 45, emoji: '🙂', text: 'Есть общее, но и различия найдутся.' },
  { min: 25, emoji: '🤔', text: 'Смотрите на мир по-разному, но это не плохо.' },
  { min: 0, emoji: '🎲', text: 'Почти противоположности — тем интереснее!' },
]

export function compatVerdict(percent) {
  return TIERS.find((t) => percent >= t.min) ?? TIERS[TIERS.length - 1]
}
