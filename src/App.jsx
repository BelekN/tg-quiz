import { useCallback, useEffect, useState } from 'react'
import HomeScreen from './screens/HomeScreen'
import QuizScreen from './screens/QuizScreen'
import ResultScreen from './screens/ResultScreen'
import LeaderboardScreen from './screens/LeaderboardScreen'
import CategoryScreen from './screens/CategoryScreen'
import SoloQuizScreen from './screens/SoloQuizScreen'
import SoloResultScreen from './screens/SoloResultScreen'
import SprintScreen from './screens/SprintScreen'
import SprintResultScreen from './screens/SprintResultScreen'
import AvatarPickerScreen from './screens/AvatarPickerScreen'
import { Loader, ErrorView } from './components/StateView'
import {
  fetchMe,
  startDuel,
  finishDuel,
  parseDuelStartParam,
  setCity,
  setAvatar,
  startSolo,
  finishSolo,
  startSprint,
  finishSprint,
} from './lib/api'
import { initTelegram, getTgUser, getStartParam } from './lib/telegram'

initTelegram()

/**
 * Роутер MVP — конечный автомат на useState.
 * React Router не подключаем: экранов четыре, а в Mini App
 * история браузера всё равно ведёт себя нестандартно.
 *
 *   boot -> home -> quiz -> result -> home
 *            ↑ (вход по ссылке сразу уводит в quiz)
 */
export default function App() {
  const [screen, setScreen] = useState('boot')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [user, setUser] = useState(null)
  const [duel, setDuel] = useState(null) // { duel_id, role, questions }
  const [result, setResult] = useState(null)

  const [solo, setSolo] = useState(null) // { session_id, category, questions }
  const [soloResult, setSoloResult] = useState(null)

  const [sprint, setSprint] = useState(null) // { session_id, questions }
  const [sprintResult, setSprintResult] = useState(null)

  const tgUser = getTgUser()

  // ---- запуск: профиль + разбор ссылки-приглашения ----
  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const me = await fetchMe()
        if (!alive) return
        setUser(me.user)

        // ?startapp=duel_<uuid> -> гость сразу попадает в дуэль
        const duelId = parseDuelStartParam(me.start_param ?? getStartParam())
        if (duelId) {
          try {
            const joined = await startDuel(duelId)
            if (!alive) return
            setDuel(joined)
            setScreen('quiz')
          } catch (e) {
            // Все вопросы отвечены, но итог не зафиксирован
            // (приложение закрыли перед финишем) — доводим до конца.
            if (e.message !== 'ALREADY_PLAYED') throw e
            const res = await finishDuel(duelId)
            if (!alive) return
            setDuel({ duel_id: duelId, role: 'guest' })
            setResult(res)
            setScreen('result')
          }
          return
        }

        setScreen('home')
      } catch (e) {
        if (alive) {
          setError(e.message)
          setScreen('error')
        }
      }
    })()

    return () => {
      alive = false
    }
  }, [])

  const createDuel = useCallback(async () => {
    setBusy(true)
    try {
      const created = await startDuel(null)
      setDuel(created)
      setScreen('quiz')
    } catch (e) {
      setError(e.message)
      setScreen('error')
    } finally {
      setBusy(false)
    }
  }, [])

  // все 5 вопросов отвечены -> просим сервер посчитать итог
  const completeDuel = useCallback(async () => {
    setScreen('finishing')
    try {
      const res = await finishDuel(duel.duel_id)
      setResult(res)
      setScreen('result')
      // локальный баланс монет держим в актуальном виде
      setUser((u) =>
        u
          ? {
              ...u,
              coins: res.coins_balance ?? u.coins + res.coins_earned,
              total_score: u.total_score + res.score,
            }
          : u,
      )
    } catch (e) {
      setError(e.message)
      setScreen('error')
    }
  }, [duel])

  const saveCity = useCallback(async (city) => {
    const res = await setCity(city)
    setUser(res.user)
  }, [])

  const pickAvatar = useCallback(async (avatarKey) => {
    try {
      const res = await setAvatar(avatarKey)
      setUser(res.user)
      setScreen('home')
    } catch (e) {
      setError(e.message)
      setScreen('error')
    }
  }, [])

  const pickCategory = useCallback(async (category) => {
    try {
      const started = await startSolo(category)
      setSolo(started)
      setScreen('solo-quiz')
    } catch (e) {
      setError(e.message)
      setScreen('error')
    }
  }, [])

  // все вопросы соло-сессии отвечены -> считаем итог
  const completeSolo = useCallback(async () => {
    setScreen('finishing')
    try {
      const res = await finishSolo(solo.session_id)
      setSoloResult(res)
      setScreen('solo-result')
      setUser((u) =>
        u
          ? {
              ...u,
              coins: res.coins_balance ?? u.coins + res.coins_earned,
              total_score: u.total_score + res.score,
            }
          : u,
      )
    } catch (e) {
      setError(e.message)
      setScreen('error')
    }
  }, [solo])

  const startSprintRun = useCallback(async () => {
    setBusy(true)
    try {
      const started = await startSprint()
      setSprint(started)
      setScreen('sprint')
    } catch (e) {
      setError(e.message)
      setScreen('error')
    } finally {
      setBusy(false)
    }
  }, [])

  // 60 секунд истекли (или вопросы кончились) -> считаем итог
  const completeSprint = useCallback(async () => {
    setScreen('finishing')
    try {
      const res = await finishSprint(sprint.session_id)
      setSprintResult(res)
      setScreen('sprint-result')
      setUser((u) =>
        u
          ? {
              ...u,
              coins: res.coins_balance ?? u.coins + res.coins_earned,
              total_score: u.total_score + res.score,
            }
          : u,
      )
    } catch (e) {
      setError(e.message)
      setScreen('error')
    }
  }, [sprint])

  const goHome = useCallback(async () => {
    setDuel(null)
    setResult(null)
    setSolo(null)
    setSoloResult(null)
    setSprint(null)
    setSprintResult(null)
    setError(null)
    setScreen('home')
    // подтянуть баланс на случай, если соперник дозакрыл дуэль
    try {
      const me = await fetchMe()
      setUser(me.user)
    } catch {
      /* необязательное обновление — молча игнорируем */
    }
  }, [])

  switch (screen) {
    case 'boot':
      return <Loader label="Входим через Telegram…" />

    case 'finishing':
      return <Loader label="Считаем результат…" />

    case 'error':
      return <ErrorView code={error} onRetry={goHome} />

    case 'quiz':
      return (
        <QuizScreen
          duelId={duel.duel_id}
          questions={duel.questions}
          startIndex={duel.answered ?? 0}
          startCorrect={duel.correct ?? 0}
          onComplete={completeDuel}
          onError={(code) => {
            setError(code)
            setScreen('error')
          }}
        />
      )

    case 'result':
      return (
        <ResultScreen result={result} role={duel?.role} onHome={goHome} />
      )

    case 'leaderboard':
      return <LeaderboardScreen onBack={() => setScreen('home')} />

    case 'avatar-picker':
      return (
        <AvatarPickerScreen
          currentAvatarKey={user?.avatar_key}
          onBack={() => setScreen('home')}
          onPick={pickAvatar}
        />
      )

    case 'categories':
      return (
        <CategoryScreen onBack={() => setScreen('home')} onPick={pickCategory} />
      )

    case 'solo-quiz':
      return (
        <SoloQuizScreen
          sessionId={solo.session_id}
          category={solo.category}
          questions={solo.questions}
          onComplete={completeSolo}
          onError={(code) => {
            setError(code)
            setScreen('error')
          }}
        />
      )

    case 'solo-result':
      return (
        <SoloResultScreen
          result={soloResult}
          onHome={goHome}
          onPlayAgain={() => setScreen('categories')}
        />
      )

    case 'sprint':
      return (
        <SprintScreen
          sessionId={sprint.session_id}
          questions={sprint.questions}
          onComplete={completeSprint}
          onError={(code) => {
            setError(code)
            setScreen('error')
          }}
        />
      )

    case 'sprint-result':
      return (
        <SprintResultScreen
          result={sprintResult}
          onHome={goHome}
          onPlayAgain={startSprintRun}
        />
      )

    default:
      return (
        <HomeScreen
          user={user}
          tgUser={tgUser}
          busy={busy}
          onCreateDuel={createDuel}
          onLeaderboard={() => setScreen('leaderboard')}
          onSaveCity={saveCity}
          onQuizTests={() => setScreen('categories')}
          onSprint={startSprintRun}
          onEditAvatar={() => setScreen('avatar-picker')}
        />
      )
  }
}
