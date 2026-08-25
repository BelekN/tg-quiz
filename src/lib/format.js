const numberFormatter = new Intl.NumberFormat('ru-RU')

/**
 * 12500 -> "12 500". Нечисловые значения (например "8/10" —
 * дробь правильных ответов в квиз-тестах) возвращает как есть.
 */
export function formatNumber(n) {
  if (typeof n === 'number') return Number.isFinite(n) ? numberFormatter.format(n) : 0
  return n ?? 0
}

/** 1 -> "день", 2 -> "дня", 5 -> "дней" — для подписи под 🔥-стриком. */
export function pluralDays(n) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'дня'
  return 'дней'
}
