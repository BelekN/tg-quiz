const numberFormatter = new Intl.NumberFormat('ru-RU')

/**
 * 12500 -> "12 500". Нечисловые значения (например "8/10" —
 * дробь правильных ответов в квиз-тестах) возвращает как есть.
 */
export function formatNumber(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return n ?? 0
  return numberFormatter.format(n)
}
