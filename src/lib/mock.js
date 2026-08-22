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

const state = { score: 0, correct: 0 }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export const mockApi = {
  async me() {
    await wait(300)
    return {
      user: {
        tg_id: 99281932,
        username: 'dev_user',
        first_name: 'Dev',
        photo_url: null,
        total_score: 1240,
        coins: 85,
      },
      start_param: null,
    }
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
}
