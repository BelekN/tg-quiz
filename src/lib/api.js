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

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Схема `tma` — рекомендованный Telegram способ передачи initData
      Authorization: `tma ${initDataRaw}`,
      // apikey намеренно не шлём: функция задеплоена с --no-verify-jwt,
      // шлюз Supabase этот заголовок не требует, а Edge Function
      // разрешает в CORS только authorization/content-type — лишний
      // заголовок валит preflight с "not allowed by
      // Access-Control-Allow-Headers" ещё до отправки запроса.
    },
    body: JSON.stringify({ action, payload }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || `HTTP_${res.status}`)
  return data
}

export class ApiError extends Error {}

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

/** duel_<uuid> -> uuid */
export function parseDuelStartParam(startParam) {
  const m = /^duel_([0-9a-fA-F-]{36})$/.exec(startParam ?? '')
  return m ? m[1] : null
}
