import { getRawInitData } from './telegram'
import { mockApi } from './mock'

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tg-api`
const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK === '1'

/**
 * Все обращения к бэкенду идут через одну Edge Function.
 * Напрямую в таблицы клиент не пишет: RLS запрещает всё,
 * поэтому подделать очки/монеты из DevTools невозможно.
 */
async function call(action, payload = {}) {
  if (USE_MOCK) return mockApi[action](payload)

  const initDataRaw = getRawInitData()
  if (!initDataRaw) throw new ApiError('NO_INIT_DATA')

  let res
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Схема `tma` — рекомендованный Telegram способ передачи initData
        Authorization: `tma ${initDataRaw}`,
        // apikey намеренно не шлём: функция задеплоена с --no-verify-jwt,
        // шлюз Supabase этот заголовок не требует, а на CORS его
        // добавление ничего не даёт — Edge Function и так разрешает
        // authorization, content-type, apikey, x-client-info (см.
        // supabase/functions/tg-api/index.ts).
      },
      body: JSON.stringify({ action, payload }),
    })
  } catch (e) {
    // fetch() сам бросает при разрыве сети/DNS/CORS — без этого наружу
    // утекал бы сырой текст браузера ("Load failed", "Failed to
    // fetch"), непонятный пользователю и не подхватываемый MESSAGES.
    // Настоящую причину не прячем: кладём её в detail, чтобы было что
    // показать пользователю и что присылать нам для диагностики —
    // OFFLINE и NETWORK_ERROR выглядят для юзера одинаково подозрительно,
    // но если navigator.onLine=false, это точно не наша сторона.
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    throw new ApiError(
      offline ? 'OFFLINE' : 'NETWORK_ERROR',
      `${e?.name ?? 'Error'}: ${e?.message ?? String(e)}`,
    )
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(data.error || `HTTP_${res.status}`, `HTTP ${res.status}`)
  }
  return data
}

export class ApiError extends Error {
  constructor(code, detail = null) {
    super(code)
    this.detail = detail
  }
}

/** Апсерт профиля + баланс. -> { user, start_param } */
export const fetchMe = () => call('me')

/** duelId=null -> создать дуэль; иначе войти как гость. */
export const startDuel = (duelId = null) =>
  call('start_duel', { duel_id: duelId })

/**
 * Отправляет ответ на вопрос №index и получает правильный вариант.
 * Правильный ответ приходит ТОЛЬКО так — после фиксации выбора,
 * и только на текущий вопрос. Заранее подсмотреть нельзя.
 * -> { correct_option_index, is_correct, points }
 */
export const answerQuestion = (duelId, index, answer, elapsedMs) =>
  call('answer_question', {
    duel_id: duelId,
    index,
    answer, // null = время вышло
    elapsed_ms: elapsedMs,
  })

/** Закрыть дуэль. Очки суммирует сервер из своих же записей. */
export const finishDuel = (duelId) => call('finish_duel', { duel_id: duelId })

/**
 * Прогресс соперника в текущей дуэли — поллинг вместо realtime.
 * -> { opponent_joined, opponent_answered, opponent_finished, opponent_score, total, outcome }
 */
export const fetchDuelProgress = (duelId) => call('duel_progress', { duel_id: duelId })

/**
 * Реванш: новая дуэль с тем же соперником, что был в finishedDuelId
 * (сервер сам его определяет и пушит ему приглашение).
 * -> { duel_id, role: 'host', status, questions, answered: 0, correct: 0 }
 */
export const rematchDuel = (finishedDuelId) =>
  call('rematch_duel', { duel_id: finishedDuelId })

/** Топ-20 по total_score + позиция текущего игрока. -> { top, me } */
export const fetchLeaderboard = () => call('leaderboard')

/** Последние сыгранные дуэли/квиз-тесты/спринты. -> { items: [...] } */
export const fetchHistory = () => call('history')

/** Каталог достижений + что уже разблокировано. -> { items: [...] } */
export const fetchAchievements = () => call('achievements')

/** Сохранить город (вводится пользователем один раз). -> { user } */
export const setCity = (city) => call('set_city', { city })

/** Сохранить выбранную аватарку. avatarKey=null -> вернуть фото Telegram. -> { user } */
export const setAvatar = (avatarKey) => call('set_avatar', { avatar_key: avatarKey })

/** Категории соло-режима с числом вопросов. -> { categories: [{category, count}] } */
export const fetchCategories = () => call('categories')

/** Начать соло-сессию по категории. -> { session_id, category, questions } */
export const startSolo = (category) => call('start_solo', { category })

/** Ответ в соло-режиме. -> { correct_option_index, is_correct, points } */
export const answerSolo = (sessionId, index, answer) =>
  call('answer_solo', { session_id: sessionId, index, answer })

/** Закрыть соло-сессию. Очки суммирует сервер. */
export const finishSolo = (sessionId) =>
  call('finish_solo', { session_id: sessionId })

/** Начать спринт: 40 вопросов вперемешку, 60 сек считает сервер. -> { session_id, started_at, duration_ms, questions } */
export const startSprint = () => call('start_sprint')

/** Ответ в спринте. Сервер сам отклонит, если 60 сек истекли. -> { correct_option_index, is_correct, points } */
export const answerSprint = (sessionId, index, answer) =>
  call('answer_sprint', { session_id: sessionId, index, answer })

/** Закрыть спринт. Очки суммирует сервер из уже записанных ответов. */
export const finishSprint = (sessionId) =>
  call('finish_sprint', { session_id: sessionId })

/** duel_<uuid> -> uuid */
export function parseDuelStartParam(startParam) {
  const m = /^duel_([0-9a-fA-F-]{36})$/.exec(startParam ?? '')
  return m ? m[1] : null
}
