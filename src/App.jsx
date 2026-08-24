import { useCallback, useEffect, useState } from 'react'
import HomeScreen from './screens/HomeScreen'
import QuizScreen from './screens/QuizScreen'
import ResultScreen from './screens/ResultScreen'
import LeaderboardScreen from './screens/LeaderboardScreen'
import HistoryScreen from './screens/HistoryScreen'
import AchievementsScreen from './screens/AchievementsScreen'
import AchievementToast from './components/AchievementToast'
import CategoryScreen from './screens/CategoryScreen'
import SoloQuizScreen from './screens/SoloQuizScreen'
import SoloResultScreen from './screens/SoloResultScreen'
import SprintScreen from './screens/SprintScreen'
import SprintResultScreen from './screens/SprintResultScreen'
import AvatarPickerScreen from './screens/AvatarPickerScreen'
import PersonaListScreen from './screens/PersonaListScreen'
import PersonaQuizScreen from './screens/PersonaQuizScreen'
import PersonaResultScreen from './screens/PersonaResultScreen'
import { Loader, ErrorView } from './components/StateView'
import {
  fetchMe,
  startDuel,
  finishDuel,
  rematchDuel,
  parseDuelStartParam,
  setCity,
  setAvatar,
  startSolo,
  finishSolo,
  startSprint,
  finishSprint,
  startPersona,
  finishPersona,
} from './lib/api'
import { computePersonaResult } from './lib/persona'
import { initTelegram, getTgUser, getStartParam } from './lib/telegram'

initTelegram()

// Первый fetchMe() при холодном старте — самый чувствительный запрос:
// один сетевой блип здесь оставляет пользователя на экране ошибки без
// профиля. Ретраим только NETWORK_ERROR (обрыв самого fetch) — если
// сервер ответил, но с ошибкой (UNAUTHORIZED и т.п.), повтор не
// поможет и только оттянет показ настоящей причины.
async function fetchMeWithRetry(retries = 2) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchMe()
    } catch (e) {
      if ((e.message !== 'NETWORK_ERROR' && e.message !== 'OFFLINE') || attempt >= retries) throw e
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
    }
  }
}

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
  const [errorDetail, setErrorDetail] = useState(null)
  const [busy, setBusy] = useState(false)

  // Единая точка показа ошибки: код всегда из e.message (стабильный,
  // на него смотрит MESSAGES и retry-проверки), detail — реальная
  // причина от браузера/сервера, если она есть, чтобы пользователь мог
  // прислать её нам как есть, а не только обезличенный код.
  const showError = useCallback((e) => {
    setError(e.message)
    setErrorDetail(e.detail ?? null)
    setScreen('error')
  }, [])

  const [user, setUser] = useState(null)
  const [duel, setDuel] = useState(null) // { duel_id, role, questions }
  const [result, setResult] = useState(null)

  const [solo, setSolo] = useState(null) // { session_id, category, questions }
  const [soloResult, setSoloResult] = useState(null)

  const [sprint, setSprint] = useState(null) // { session_id, questions }
  const [sprintResult, setSprintResult] = useState(null)

  const [persona, setPersona] = useState(null) // { session_id, test_key, title, scoring, questions, results }
  const [personaResult, setPersonaResult] = useState(null)

  const [newAchievements, setNewAchievements] = useState(null)

  const tgUser = getTgUser()

  // ---- запуск: профиль + разбор ссылки-приглашения ----
  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const me = await fetchMeWithRetry()
        if (!alive) return
        setUser(me.user)
        if (me.new_achievements?.length) setNewAchievements(me.new_achievements)

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
        if (alive) showError(e)
      }
    })()

    return () => {
      alive = false
    }
  }, [showError])

  const createDuel = useCallback(async () => {
    setBusy(true)
    try {
      const created = await startDuel(null)
      setDuel(created)
      setScreen('quiz')
    } catch (e) {
      showError(e)
    } finally {
      setBusy(false)
    }
  }, [showError])

  // "Реванш" на экране результата — новая дуэль с тем же соперником,
  // сервер сам его определяет из только что завершённой дуэли и
  // шлёт ему пуш с приглашением.
  const rematch = useCallback(async () => {
    setScreen('rematching')
    try {
      const created = await rematchDuel(result.duel_id)
      setDuel(created)
      setResult(null)
      setScreen('quiz')
    } catch (e) {
      showError(e)
    }
  }, [result, showError])

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
      if (res.new_achievements?.length) setNewAchievements(res.new_achievements)
    } catch (e) {
      showError(e)
    }
  }, [duel, showError])

  // Соперник доиграл ПОЗЖЕ нас — пока мы сидели на "Ждём соперника",
  // ResultScreen сам поллит get_duel_progress и вызывает это, когда
  // видит opponent_finished. Бонусные монеты за победу/ничью сервер
  // уже начислил (это сделал finish_duel самого соперника) — здесь
  // только подтягиваем актуальную картину, не начисляем повторно.
  const handleOpponentFinished = useCallback((progress) => {
    setResult((r) =>
      r && {
        ...r,
        opponent_score: progress.opponent_score,
        outcome: progress.outcome,
        coins_earned:
          r.coins_earned +
          (progress.outcome === 'win' ? 20 : progress.outcome === 'draw' ? 10 : 0),
      },
    )
    fetchMe()
      .then((me) => setUser(me.user))
      .catch(() => {})
  }, [])

  // Сетевой сбой посреди дуэли (например, на answer_question) раньше
  // уводил на общий экран ошибки, откуда единственный путь — "На
  // главную", безвозвратно теряя duel_id (в том числе инвайт-ссылку,
  // если её уже отправили другу). start_duel теперь разрешает хосту
  // вернуться в свою же дуэль и резюмирует с уже отвеченного вопроса.
  const resumeDuel = useCallback(async () => {
    if (!duel?.duel_id) return
    setScreen('resuming')
    try {
      const resumed = await startDuel(duel.duel_id)
      setDuel(resumed)
      setScreen('quiz')
    } catch (e) {
      showError(e)
    }
  }, [duel, showError])

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
      showError(e)
    }
  }, [showError])

  const pickCategory = useCallback(async (category) => {
    try {
      const started = await startSolo(category)
      setSolo(started)
      setScreen('solo-quiz')
    } catch (e) {
      showError(e)
    }
  }, [showError])

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
      if (res.new_achievements?.length) setNewAchievements(res.new_achievements)
    } catch (e) {
      showError(e)
    }
  }, [solo, showError])

  const startSprintRun = useCallback(async () => {
    setBusy(true)
    try {
      const started = await startSprint()
      setSprint(started)
      setScreen('sprint')
    } catch (e) {
      showError(e)
    } finally {
      setBusy(false)
    }
  }, [showError])

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
      if (res.new_achievements?.length) setNewAchievements(res.new_achievements)
    } catch (e) {
      showError(e)
    }
  }, [sprint, showError])

  const pickPersonaTest = useCallback(async (testKey) => {
    try {
      const started = await startPersona(testKey)
      setPersona(started)
      setScreen('persona-quiz')
    } catch (e) {
      showError(e)
    }
  }, [showError])

  // result_key считаем на клиенте (см. lib/persona.js) — сервер здесь
  // только проверяет, что такой результат существует у этого теста.
  const completePersona = useCallback(async (answers) => {
    setScreen('finishing')
    try {
      const resultKey = computePersonaResult(persona.scoring, answers, persona.results)
      const res = await finishPersona(persona.session_id, resultKey)
      setPersonaResult(res)
      setScreen('persona-result')
      if (res.new_achievements?.length) setNewAchievements(res.new_achievements)
    } catch (e) {
      showError(e)
    }
  }, [persona, showError])

  const goHome = useCallback(async () => {
    setDuel(null)
    setResult(null)
    setSolo(null)
    setSoloResult(null)
    setSprint(null)
    setSprintResult(null)
    setPersona(null)
    setPersonaResult(null)
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

  const content = (() => {
  switch (screen) {
    case 'boot':
      return <Loader label="Входим через Telegram…" />

    case 'finishing':
      return <Loader label="Считаем результат…" />

    case 'resuming':
      return <Loader label="Возвращаемся в дуэль…" />

    case 'rematching':
      return <Loader label="Готовим реванш…" />

    case 'error':
      return (
        <ErrorView
          code={error}
          detail={errorDetail}
          onRetry={goHome}
          secondaryAction={
            duel?.duel_id
              ? { label: 'Продолжить дуэль', onClick: resumeDuel }
              : null
          }
        />
      )

    case 'quiz':
      return (
        <QuizScreen
          duelId={duel.duel_id}
          questions={duel.questions}
          startIndex={duel.answered ?? 0}
          startCorrect={duel.correct ?? 0}
          onComplete={completeDuel}
          onError={showError}
        />
      )

    case 'result':
      return (
        <ResultScreen
          result={result}
          role={duel?.role}
          onHome={goHome}
          onRematch={rematch}
          onOpponentFinished={handleOpponentFinished}
        />
      )

    case 'leaderboard':
      return <LeaderboardScreen onBack={() => setScreen('home')} />

    case 'history':
      return <HistoryScreen onBack={() => setScreen('home')} />

    case 'achievements':
      return <AchievementsScreen onBack={() => setScreen('home')} />

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
          onError={showError}
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
          onError={showError}
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

    case 'persona-list':
      return (
        <PersonaListScreen onBack={() => setScreen('home')} onPick={pickPersonaTest} />
      )

    case 'persona-quiz':
      return (
        <PersonaQuizScreen
          title={persona.title}
          questions={persona.questions}
          onComplete={completePersona}
        />
      )

    case 'persona-result':
      return (
        <PersonaResultScreen
          testTitle={persona.title}
          result={personaResult}
          onHome={goHome}
          onPlayAgain={() => setScreen('persona-list')}
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
          onHistory={() => setScreen('history')}
          onAchievements={() => setScreen('achievements')}
          onSaveCity={saveCity}
          onQuizTests={() => setScreen('categories')}
          onSprint={startSprintRun}
          onPersona={() => setScreen('persona-list')}
          onEditAvatar={() => setScreen('avatar-picker')}
        />
      )
  }
  })()

  return (
    <>
      <AchievementToast achievements={newAchievements} />
      {content}
    </>
  )
}
