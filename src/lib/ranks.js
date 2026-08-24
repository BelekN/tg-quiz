/**
 * Ранг — чисто витринная надстройка над total_score: сервер его не
 * хранит и не проверяет (нет ни очков, ни монет на кону), поэтому
 * пороги считаются на клиенте из уже доверенного total_score.
 */
export const RANK_TIERS = [
  { key: 'novice', name: 'Новичок', icon: '🌱', min: 0 },
  { key: 'amateur', name: 'Любитель', icon: '📗', min: 500 },
  { key: 'connoisseur', name: 'Знаток', icon: '📘', min: 1500 },
  { key: 'expert', name: 'Эксперт', icon: '🎯', min: 3500 },
  { key: 'master', name: 'Мастер', icon: '🥈', min: 7000 },
  { key: 'grandmaster', name: 'Гроссмейстер', icon: '🥇', min: 14000 },
  { key: 'legend', name: 'Легенда', icon: '👑', min: 28000 },
]

/** -> { key, name, icon, min, next, progress: {current, target} | null } */
export function getRank(totalScore) {
  const score = totalScore ?? 0
  let index = 0
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (score >= RANK_TIERS[i].min) index = i
  }
  const tier = RANK_TIERS[index]
  const next = RANK_TIERS[index + 1] ?? null

  return {
    ...tier,
    next,
    progress: next
      ? { current: score - tier.min, target: next.min - tier.min }
      : null,
  }
}
