/**
 * Итог теста из раздела "Узнай себя" считается тут, а не на сервере: ставок на
 * результат нет (ни очков, ни монет), поэтому нет смысла гонять каждый
 * ответ через RPC — server только валидирует присланный result_key
 * против каталога перед записью в историю (см. finish_persona).
 *
 * categorical — чей result_key встретился среди ответов чаще всего
 *               (ничья -> выигрывает тот, что встретился раньше).
 * scale       — сумма value попадает в [min_score, max_score] одного
 *               из результатов теста.
 */
export function computePersonaResult(scoring, answers, results) {
  if (scoring === 'scale') {
    const total = answers.reduce((sum, a) => sum + (a.value ?? 0), 0)
    const bucket = results.find((r) => total >= r.min_score && total <= r.max_score)
    return bucket?.key ?? results.at(-1)?.key ?? null
  }

  const counts = new Map()
  for (const a of answers) {
    if (!a.result_key) continue
    counts.set(a.result_key, (counts.get(a.result_key) ?? 0) + 1)
  }

  let bestKey = null
  let bestCount = -1
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestKey = key
      bestCount = count
    }
  }
  return bestKey
}
