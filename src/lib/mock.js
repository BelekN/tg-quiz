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

/** 'mixed' -> вопросы из всех категорий сразу, как в реальном start_solo. */
const poolFor = (category) =>
  category === 'mixed' ? Object.values(SOLO_QUESTIONS).flat() : SOLO_QUESTIONS[category] ?? []

const soloState = { score: 0, correct: 0, category: null }
const sprintState = { score: 0, correct: 0, questions: [] }
const dailyState = { score: 0, correct: 0, questions: QUESTIONS.slice(0, 5), played: false }
const marathonState = { score: 0, correct: 0, questions: SPRINT_POOL }
const state = { score: 0, correct: 0 }
const meUser = {
  tg_id: 99281932,
  username: 'dev_user',
  first_name: 'Dev',
  photo_url: null,
  avatar_key: null,
  city: null,
  total_score: 1240,
  coins: 85,
  current_streak: 4,
  longest_streak: 9,
  longest_marathon_streak: 6,
  reminders_enabled: true,
  equipped_frame: null,
}

const shopState = {
  cosmetics: [
    { key: 'frame_gold', title: 'Золотое кольцо', price_coins: 300, owned: false, equipped: false },
    { key: 'frame_neon_blue', title: 'Неоновый синий', price_coins: 300, owned: false, equipped: false },
    { key: 'frame_neon_pink', title: 'Неоновый розовый', price_coins: 300, owned: false, equipped: false },
    { key: 'frame_rainbow', title: 'Радуга', price_coins: 600, owned: false, equipped: false },
  ],
}
const COIN_PACKS = [
  { key: 'coins_small', title: '500 монет', stars: 50, coins: 500 },
  { key: 'coins_medium', title: '1 800 монет', stars: 150, coins: 1800 },
  { key: 'coins_large', title: '5 500 монет', stars: 400, coins: 5500 },
]
const PERSONA_TESTS = {
  mock_categorical: {
    key: 'mock_categorical',
    title: 'Мок-тест (категории)',
    description: 'Заглушка для вёрстки — categorical scoring',
    icon: '🔮',
    category: 'Мок-категория',
    scoring: 'categorical',
    questions: [
      {
        id: 'p1',
        question: 'Вопрос 1?',
        options: [
          { label: 'Вариант A', result_key: 'foo' },
          { label: 'Вариант B', result_key: 'bar' },
        ],
      },
      {
        id: 'p2',
        question: 'Вопрос 2?',
        options: [
          { label: 'Вариант A', result_key: 'foo' },
          { label: 'Вариант B', result_key: 'bar' },
        ],
      },
    ],
    results: [
      { key: 'foo', title: 'Ты — Фу', description: 'Мок-результат Foo для вёрстки.', icon: '🦊' },
      { key: 'bar', title: 'Ты — Бар', description: 'Мок-результат Bar для вёрстки.', icon: '🐻' },
    ],
  },
  mock_scale: {
    key: 'mock_scale',
    title: 'Мок-тест (шкала)',
    description: 'Заглушка для вёрстки — scale scoring',
    icon: '🔥',
    category: 'Мок-категория',
    scoring: 'scale',
    questions: [
      {
        id: 'p3',
        question: 'Вопрос со шкалой?',
        options: [
          { label: 'Никогда', value: 0 },
          { label: 'Почти всегда', value: 3 },
        ],
      },
    ],
    results: [
      { key: 'low', title: 'Низкий уровень', description: 'Мок-результат для низкого счёта.', icon: '🌤️', min_score: 0, max_score: 1 },
      { key: 'high', title: 'Высокий уровень', description: 'Мок-результат для высокого счёта.', icon: '🚨', min_score: 2, max_score: 3 },
    ],
  },
}
const personaState = { session_id: null, test_key: null }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export const mockApi = {
  async me() {
    await wait(300)
    return { user: meUser, start_param: null, new_achievements: [], force_update: false }
  },

  async set_city({ city }) {
    await wait(200)
    meUser.city = city
    return { user: meUser }
  },

  async set_reminders_enabled({ enabled }) {
    await wait(200)
    meUser.reminders_enabled = enabled
    return { user: meUser }
  },

  async set_avatar({ avatar_key }) {
    await wait(200)
    meUser.avatar_key = avatar_key
    return { user: meUser }
  },

  async shop_catalog() {
    await wait(250)
    return { cosmetics: shopState.cosmetics, coin_packs: COIN_PACKS }
  },

  async buy_cosmetic({ item_key }) {
    await wait(300)
    const item = shopState.cosmetics.find((c) => c.key === item_key)
    if (!item) throw new Error('ITEM_NOT_FOUND')
    if (item.owned) throw new Error('ALREADY_OWNED')
    if (meUser.coins < item.price_coins) throw new Error('NOT_ENOUGH_COINS')
    meUser.coins -= item.price_coins
    item.owned = true
    return { user: meUser, item_key }
  },

  async equip_frame({ item_key }) {
    await wait(200)
    if (item_key && !shopState.cosmetics.find((c) => c.key === item_key)?.owned) {
      throw new Error('NOT_OWNED')
    }
    shopState.cosmetics.forEach((c) => (c.equipped = c.key === item_key))
    meUser.equipped_frame = item_key ?? null
    return { user: meUser }
  },

  async create_stars_invoice({ pack_key }) {
    await wait(250)
    const pack = COIN_PACKS.find((p) => p.key === pack_key)
    if (!pack) throw new Error('UNKNOWN_PACK')
    // В моке нет настоящей оплаты — сразу "начисляем", чтобы можно
    // было визуально проверить экран без реального Telegram-клиента.
    meUser.coins += pack.coins
    return { invoice_url: null, mock_credited: pack.coins }
  },

  async report_issue({ message }) {
    await wait(300)
    if (!message?.trim()) throw new Error('EMPTY_MESSAGE')
    return { id: 'mock-report-1' }
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
      new_achievements: [],
    }
  },

  async rematch_duel() {
    await wait(250)
    state.score = 0
    state.correct = 0
    return {
      duel_id: '00000000-0000-4000-8000-000000000002',
      role: 'host',
      status: 'pending',
      answered: 0,
      correct: 0,
      questions: QUESTIONS.map(({ correct: _c, ...q }) => q),
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
      avatar_key: meUser.avatar_key,
      equipped_frame: meUser.equipped_frame,
      city: meUser.city,
      total_score: 1240,
      coins: 85,
    }
    const top = [
      { rank: 1, tg_id: 1, username: 'quiz_master', first_name: 'Алина', photo_url: null, avatar_key: 'fox', equipped_frame: 'frame_rainbow', city: 'Бишкек', total_score: 4820, coins: 210 },
      { rank: 2, tg_id: 2, username: 'nikita', first_name: 'Никита', photo_url: null, avatar_key: 'robot', equipped_frame: 'frame_neon_blue', city: 'Алматы', total_score: 3390, coins: 150 },
      { rank: 3, tg_id: 3, username: null, first_name: 'Асель', photo_url: null, avatar_key: 'owl', city: null, total_score: 2005, coins: 90 },
      me,
      { rank: 5, tg_id: 5, username: 'bob', first_name: 'Боб', photo_url: null, city: 'Москва', total_score: 980, coins: 40 },
    ]
    return { top, me }
  },

  async history() {
    await wait(300)
    return {
      items: [
        {
          kind: 'duel',
          id: 'h1',
          happened_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          my_score: 420,
          opponent_score: 310,
          opponent: { first_name: 'Никита', username: 'nikita', photo_url: null, avatar_key: 'robot' },
          outcome: 'win',
        },
        {
          kind: 'sprint',
          id: 'h2',
          happened_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
          score: 350,
          correct: 7,
        },
        {
          kind: 'duel',
          id: 'h3',
          happened_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
          my_score: 280,
          opponent_score: null,
          opponent: null,
          outcome: 'pending',
        },
        {
          kind: 'solo',
          id: 'h4',
          happened_at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
          category: 'geo',
          score: 900,
          correct: 9,
          total: 10,
        },
        {
          kind: 'persona',
          id: 'h5',
          happened_at: new Date(Date.now() - 1000 * 60 * 60 * 40).toISOString(),
          test_key: 'mock_categorical',
          test_title: 'Мок-тест (категории)',
          result_key: 'foo',
          result_title: 'Ты — Фу',
          icon: '🦊',
        },
      ],
    }
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
    const qs = poolFor(category)
    return {
      session_id: `solo-${category}`,
      category,
      questions: qs.map(({ correct: _c, ...q }) => q),
    }
  },

  async answer_solo({ index, answer }) {
    await wait(200)
    const qs = poolFor(soloState.category)
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
    const qs = poolFor(soloState.category)
    return {
      category: soloState.category,
      correct: soloState.correct,
      total: qs.length,
      score: soloState.score,
      coins_earned: soloState.correct * 5,
      coins_balance: 85 + soloState.correct * 5,
      new_achievements: [],
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
      new_achievements: [],
    }
  },

  async start_daily() {
    await wait(250)
    if (dailyState.played) throw new Error('ALREADY_PLAYED_TODAY')
    dailyState.score = 0
    dailyState.correct = 0
    return {
      session_id: 'daily-1',
      play_date: new Date().toISOString().slice(0, 10),
      questions: dailyState.questions.map(({ correct: _c, ...q }) => q),
    }
  },

  async answer_daily({ index, answer }) {
    await wait(200)
    const right = dailyState.questions[index].correct
    const ok = answer === right
    const points = ok ? 100 : 0
    if (ok) {
      dailyState.correct += 1
      dailyState.score += points
    }
    return { correct_option_index: right, is_correct: ok, points }
  },

  async finish_daily() {
    await wait(300)
    dailyState.played = true
    return {
      correct: dailyState.correct,
      total: dailyState.questions.length,
      score: dailyState.score,
      coins_earned: dailyState.correct * 5,
      coins_balance: 85 + dailyState.correct * 5,
      new_achievements: [],
    }
  },

  async start_marathon() {
    await wait(250)
    marathonState.score = 0
    marathonState.correct = 0
    return {
      session_id: 'marathon-1',
      questions: marathonState.questions.map(({ correct: _c, ...q }) => q),
    }
  },

  async answer_marathon({ index, answer }) {
    await wait(150)
    const right = marathonState.questions[index].correct
    const ok = answer === right
    const points = ok ? 100 : 0
    if (ok) {
      marathonState.correct += 1
      marathonState.score += points
    }
    return { correct_option_index: right, is_correct: ok, points }
  },

  async finish_marathon() {
    await wait(300)
    return {
      correct: marathonState.correct,
      score: marathonState.score,
      coins_earned: marathonState.correct * 5,
      coins_balance: 85 + marathonState.correct * 5,
      best_streak: Math.max(6, marathonState.correct),
      new_achievements: [],
    }
  },

  async achievements() {
    await wait(250)
    return {
      items: [
        { key: 'first_duel', title: 'Первая дуэль', description: 'Сыграйте свою первую дуэль', icon: '⚔️', category: 'Дуэли', unlocked_at: new Date().toISOString(), progress: null },
        { key: 'duel_wins_10', title: 'Ветеран', description: 'Одержите 10 побед в дуэлях', icon: '🎖️', category: 'Дуэли', unlocked_at: null, progress: { current: 3, target: 10 } },
        { key: 'win_streak_3', title: 'Не остановить', description: '3 победы в дуэлях подряд', icon: '🔥', category: 'Дуэли', unlocked_at: null, progress: { current: 1, target: 3 } },
        { key: 'real_duel', title: 'Настоящий соперник', description: 'Заверши дуэль, в которой реально участвовали два игрока', icon: '🤝', category: 'Дуэли', unlocked_at: new Date().toISOString(), progress: null },
        { key: 'rematch_5', title: 'Заядлый реваншист', description: 'Сыграй 5 реваншей', icon: '🔁', category: 'Дуэли', unlocked_at: null, progress: { current: 0, target: 5 } },
        { key: 'perfect_solo', title: 'Идеально', description: '100% правильных ответов в квиз-тесте', icon: '💯', category: 'Соло и спринт', unlocked_at: null, progress: null },
        { key: 'sprint_ace', title: 'Скорострел', description: '20+ правильных ответов в Спринте', icon: '⚡', category: 'Соло и спринт', unlocked_at: null, progress: { current: 8, target: 20 } },
        { key: 'all_categories', title: 'Эрудит', description: 'Сыграйте квиз-тест во всех категориях', icon: '🧠', category: 'Соло и спринт', unlocked_at: null, progress: { current: 2, target: 10 } },
        { key: 'all_personas', title: 'Исследователь личности', description: 'Пройди все тесты в разделе «Узнай себя»', icon: '🔮', category: 'Узнай себя', unlocked_at: null, progress: { current: 1, target: 12 } },
        { key: 'score_5000', title: 'Профи', description: 'Наберите 5000 очков всего', icon: '🏆', category: 'Особые', unlocked_at: null, progress: { current: 1240, target: 5000 } },
        { key: 'all_modes', title: 'Универсал', description: 'Сыграй в дуэль, квиз-тест и спринт хотя бы раз', icon: '🎯', category: 'Особые', unlocked_at: null, progress: { current: 1, target: 3 } },
        { key: 'night_owl', title: 'Полуночник', description: 'Сыграй что-нибудь между полуночью и 5 утра', icon: '🦉', category: 'Особые', unlocked_at: null, progress: null },
      ],
    }
  },

  async persona_tests() {
    await wait(200)
    return {
      items: Object.values(PERSONA_TESTS).map(({ questions: _q, results: _r, ...t }) => t),
    }
  },

  async start_persona({ test_key }) {
    await wait(250)
    const test = PERSONA_TESTS[test_key]
    personaState.session_id = `persona-${test_key}`
    personaState.test_key = test_key
    return {
      session_id: personaState.session_id,
      test_key: test.key,
      title: test.title,
      scoring: test.scoring,
      questions: test.questions,
      results: test.results.map(({ title: _t, description: _d, icon: _i, ...r }) => r),
    }
  },

  async finish_persona({ result_key }) {
    await wait(300)
    const test = PERSONA_TESTS[personaState.test_key]
    const result = test.results.find((r) => r.key === result_key)
    return { test_key: test.key, key: result.key, title: result.title, description: result.description, icon: result.icon, new_achievements: [] }
  },

  async duel_progress() {
    await wait(200)
    return {
      opponent_joined: true,
      opponent_answered: 2,
      opponent_finished: false,
      opponent_score: null,
      total: QUESTIONS.length,
      outcome: 'pending',
    }
  },
}
