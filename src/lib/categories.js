/** Иконка и подпись для категорий соло-режима. Ключи — то же, что в БД. */
export const CATEGORY_META = {
  geo: { icon: '🌍', label: 'География' },
  science: { icon: '🔬', label: 'Наука' },
  culture: { icon: '🎭', label: 'Культура' },
  tech: { icon: '💻', label: 'Технологии' },
  sport: { icon: '⚽', label: 'Спорт' },
  general: { icon: '🧩', label: 'Общие знания' },
  movies: { icon: '🎬', label: 'Кино' },
  history: { icon: '🏛', label: 'История' },
  gaming: { icon: '🎮', label: 'Гик-культура' },
  food: { icon: '🍕', label: 'Еда и напитки' },
  mixed: { icon: '🎲', label: 'Случайный микс' },
}

export function categoryMeta(key) {
  return CATEGORY_META[key] ?? { icon: '❓', label: key }
}
