/**
 * Локальные заглушки для вёрстки: `VITE_DEV_MOCK=1 npm run dev`.
 * Позволяют крутить все экраны в обычном браузере, без бота
 * и без задеплоенной Edge Function.
 */
const QUESTIONS = [
  {
    id: 'q1',
    question: 'Столица Австралии?',
    options: ['Сидней', 'Канберра', 'Мельбурн', 'Перт'],
    correct: 1,
    category: 'geo',
  },
  {
    id: 'q2',
    question: 'Химический символ золота?',
    options: ['Ag', 'Au', 'Fe', 'Gd'],
    correct: 1,
    category: 'science',
  },
  {
    id: 'q3',
    question: 'Кто основал Telegram?',
    options: ['Цукерберг', 'Дуров', 'Маск', 'Брин'],
    correct: 1,
    category: 'tech',
  },
  {
    id: 'q4',
    question: 'Какая планета ближе всего к Солнцу?',
    options: ['Венера', 'Меркурий', 'Марс', 'Земля'],
    correct: 1,
    category: 'science',
  },
  {
    id: 'q5',
    question: 'В каком году вышел первый iPhone?',
    options: ['2005', '2006', '2007', '2008'],
    correct: 2,
    category: 'tech',
  },
]

const SOLO_QUESTIONS = {
  geo: [
    { id: 'g1', question: 'Столица Японии?', options: ['Токио', 'Осака', 'Киото', 'Нагоя'], correct: 0, category: 'geo' },
    { id: 'g2', question: 'Самая высокая гора в мире?', options: ['Эверест', 'К2', 'Килиманджаро', 'Эльбрус'], correct: 0, category: 'geo' },
  ],
  movies: [
    { id: 'm1', question: 'Кто режиссёр фильма «Титаник»?', options: ['Спилберг', 'Кэмерон', 'Нолан', 'Скотт'], correct: 1, category: 'movies' },
    { id: 'm2', question: 'В какой саге есть Дарт Вейдер?', options: ['Звёздные войны', 'Властелин колец', 'Гарри Поттер', 'Матрица'], correct: 0, category: 'movies' },
  ],
  gaming: [
    { id: 'gm1', question: 'Кто выпускает игры про Марио?', options: ['Sony', 'Nintendo', 'Sega', 'Microsoft'], correct: 1, category: 'gaming' },
    { id: 'gm2', question: 'Главный герой Zelda?', options: ['Зельда', 'Линк', 'Ганон', 'Марио'], correct: 1, category: 'gaming' },
  ],
}

const SPRINT_POOL = [...QUESTIONS, ...Object.values(SOLO_QUESTIONS).flat()]

const soloState = { score: 0, correct: 0, category: null }
const sprintState = { score: 0, correct: 0, questions: [] }
const state = { score: 0, correct: 0 }
const meUser = {
  tg_id: 99281932,
  username: 'dev_user',
  first_name: 'Dev',
  photo_url: null,
  city: null,
  total_score: 1240,
  coins: 85,
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export const mockApi = {
  async me() {
    await wait(300)
    return { user: meUser, start_param: null }
  },

  async set_city({ city }) {
    await wait(200)
    meUser.city = city
    return { user: meUser }
  },

  async start_duel() {
    await wait(250)
    state.score = 0
    state.correct = 0
    return {
      duel_id: '00000000-0000-4000-8000-000000000001',
      role: 'host',
      status: 'pending',
      answered: 0,
      correct: 0,
      // наружу отдаём без correct — ровно как настоящий сервер
      questions: QUESTIONS.map(({ correct: _c, ...q }) => q),
    }
  },

  async answer_question({ index, answer, elapsed_ms }) {
    await wait(200)
    const right = QUESTIONS[index].correct
    const ok = answer === right
    const points = ok ? 100 + Math.floor((10000 - elapsed_ms) / 100) : 0
    if (ok) {
      state.correct += 1
      state.score += points
    }
    return { correct_option_index: right, is_correct: ok, points }
  },

  async finish_duel({ duel_id }) {
    await wait(400)
    return {
      duel_id,
      role: 'host',
      correct: state.correct,
      total: QUESTIONS.length,
      score: state.score,
      coins_earned: state.correct * 5,
      coins_balance: 85 + state.correct * 5,
      opponent_score: null,
      outcome: 'pending',
    }
  },

  async leaderboard() {
    await wait(300)
    const me = {
      rank: 4,
      tg_id: 99281932,
      username: 'dev_user',
      first_name: 'Dev',
      photo_url: null,
      city: meUser.city,
      total_score: 1240,
      coins: 85,
    }
    const top = [
      { rank: 1, tg_id: 1, username: 'quiz_master', first_name: 'Алина', photo_url: null, city: 'Бишкек', total_score: 4820, coins: 210 },
      { rank: 2, tg_id: 2, username: 'nikita', first_name: 'Никита', photo_url: null, city: 'Алматы', total_score: 3390, coins: 150 },
      { rank: 3, tg_id: 3, username: null, first_name: 'Асель', photo_url: null, city: null, total_score: 2005, coins: 90 },
      me,
      { rank: 5, tg_id: 5, username: 'bob', first_name: 'Боб', photo_url: null, city: 'Москва', total_score: 980, coins: 40 },
    ]
    return { top, me }
  },

  async categories() {
    await wait(200)
    return {
      categories: Object.entries(SOLO_QUESTIONS).map(([category, qs]) => ({
        category,
        count: qs.length,
      })),
    }
  },

  async start_solo({ category }) {
    await wait(250)
    soloState.score = 0
    soloState.correct = 0
    soloState.category = category
    const qs = SOLO_QUESTIONS[category] ?? []
    return {
      session_id: `solo-${category}`,
      category,
      questions: qs.map(({ correct: _c, ...q }) => q),
    }
  },

  async answer_solo({ index, answer }) {
    await wait(200)
    const qs = SOLO_QUESTIONS[soloState.category] ?? []
    const right = qs[index].correct
    const ok = answer === right
    const points = ok ? 100 : 0
    if (ok) {
      soloState.correct += 1
      soloState.score += points
    }
    return { correct_option_index: right, is_correct: ok, points }
  },

  async finish_solo() {
    await wait(300)
    const qs = SOLO_QUESTIONS[soloState.category] ?? []
    return {
      category: soloState.category,
      correct: soloState.correct,
      total: qs.length,
      score: soloState.score,
      coins_earned: soloState.correct * 5,
      coins_balance: 85 + soloState.correct * 5,
    }
  },

  async start_sprint() {
    await wait(250)
    sprintState.score = 0
    sprintState.correct = 0
    sprintState.questions = SPRINT_POOL
    return {
      session_id: 'sprint-1',
      started_at: new Date().toISOString(),
      duration_ms: 60_000,
      questions: SPRINT_POOL.map(({ correct: _c, ...q }) => q),
    }
  },

  async answer_sprint({ index, answer }) {
    await wait(150)
    const right = sprintState.questions[index].correct
    const ok = answer === right
    const points = ok ? 50 : 0
    if (ok) {
      sprintState.correct += 1
      sprintState.score += points
    }
    return { correct_option_index: right, is_correct: ok, points }
  },

  async finish_sprint() {
    await wait(300)
    return {
      answered: sprintState.correct,
      correct: sprintState.correct,
      score: sprintState.score,
      coins_earned: sprintState.correct * 3,
      coins_balance: 85 + sprintState.correct * 3,
    }
  },
}
