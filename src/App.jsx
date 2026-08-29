import { useCallback, useEffect, useState } from 'react'
import HomeScreen from './screens/HomeScreen'
import FunHubScreen from './screens/FunHubScreen'
import ProfileScreen from './screens/ProfileScreen'
import TabBar from './components/TabBar'
import DuelIntroScreen from './screens/DuelIntroScreen'
import QuizScreen from './screens/QuizScreen'
import ResultScreen from './screens/ResultScreen'
import LeaderboardScreen from './screens/LeaderboardScreen'
import HistoryScreen from './screens/HistoryScreen'
import AchievementsScreen from './screens/AchievementsScreen'
import AchievementToast from './components/AchievementToast'
import RankUpToast from './components/RankUpToast'
import CategoryScreen from './screens/CategoryScreen'
import SoloQuizScreen from './screens/SoloQuizScreen'
import SoloResultScreen from './screens/SoloResultScreen'
import SprintIntroScreen from './screens/SprintIntroScreen'
import DailyIntroScreen from './screens/DailyIntroScreen'
import DailyQuizScreen from './screens/DailyQuizScreen'
import DailyResultScreen from './screens/DailyResultScreen'
import MarathonIntroScreen from './screens/MarathonIntroScreen'
import MarathonScreen from './screens/MarathonScreen'
import MarathonResultScreen from './screens/MarathonResultScreen'
import SprintScreen from './screens/SprintScreen'
import SprintResultScreen from './screens/SprintResultScreen'
import PersonaListScreen from './screens/PersonaListScreen'
import PersonaQuizScreen from './screens/PersonaQuizScreen'
import PersonaResultScreen from './screens/PersonaResultScreen'
import CompatListScreen from './screens/CompatListScreen'
import CompatIntroScreen from './screens/CompatIntroScreen'
import CompatQuizScreen from './screens/CompatQuizScreen'
import CompatResultScreen from './screens/CompatResultScreen'
import NumerologyListScreen from './screens/NumerologyListScreen'
import NumerologyInputScreen from './screens/NumerologyInputScreen'
import NumerologyResultScreen from './screens/NumerologyResultScreen'
import { Loader, ErrorView } from './components/StateView'
import ReportIssueScreen from './screens/ReportIssueScreen'
import SettingsScreen from './screens/SettingsScreen'
import ShopScreen from './screens/ShopScreen'
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen'
import TermsScreen from './screens/TermsScreen'
import ForceUpdateScreen from './screens/ForceUpdateScreen'
import {
  fetchMe,
  startDuel,
  finishDuel,
  rematchDuel,
  parseDuelStartParam,
  setCity,
  startSolo,
  finishSolo,
  startSprint,
  finishSprint,
  startDaily,
  finishDaily,
  startMarathon,
  finishMarathon,
  startPersona,
  finishPersona,
  startCompat,
  parseCompatStartParam,
  computeNumerology,
} from './lib/api'
import { computePersonaResult } from './lib/persona'
import { getRank } from './lib/ranks'
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

  const [daily, setDaily] = useState(null) // { session_id, play_date, questions }
  const [dailyResult, setDailyResult] = useState(null)

  const [marathon, setMarathon] = useState(null) // { session_id, questions }
  const [marathonResult, setMarathonResult] = useState(null)

  const [persona, setPersona] = useState(null) // { session_id, test_key, title, scoring, questions, results }
  const [personaResult, setPersonaResult] = useState(null)

  const [compat, setCompat] = useState(null) // { session_id, role, test_key, title, description, icon, questions }
  const [compatResult, setCompatResult] = useState(null)

  const [numerologyTest, setNumerologyTest] = useState(null) // { key, title, description, icon }
  const [numerologyResult, setNumerologyResult] = useState(null)

  const [newAchievements, setNewAchievements] = useState(null)
  const [newRank, setNewRank] = useState(null)
  const [reportContext, setReportContext] = useState(null)
  // Аватарку можно открыть и с "Играть", и с "Профиль" — запоминаем,
  // куда вернуться после выбора, а не жёстко на одну вкладку.

  const tgUser = getTgUser()

  // ---- запуск: профиль + разбор ссылки-приглашения ----
  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const me = await fetchMeWithRetry()
        if (!alive) return
        setUser(me.user)

        // Сервер сравнил присланную версию с MIN_APP_VERSION (см.
        // tg-api "me") — эта сборка устарела, дальше пускать нельзя:
        // старый бандл может не совпадать со схемой RPC-ответов.
        if (me.force_update) {
          setScreen('force-update')
          return
        }

        if (me.new_achievements?.length) setNewAchievements(me.new_achievements)

        // ?startapp=duel_<uuid> -> гость сразу попадает в дуэль
        const duelId = parseDuelStartParam(me.start_param ?? getStartParam())
        if (duelId) {
          try {
            const joined = await startDuel(duelId)
            if (!alive) return
            setDuel(joined)
            // Уже отвечал раньше (перезаход после сетевого сбоя) —
            // продолжаем сразу, вступление тут неуместно.
            setScreen(joined.answered > 0 ? 'quiz' : 'duel-intro')
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

        // ?startapp=compat_<uuid> -> гость присоединяется, а хост,
        // открывший мини-апп по пушу "партнёр прошёл тест", резюмирует
        // свою же сессию — если она уже завершена, сразу на результат,
        // а не заново через вступление/вопросы.
        const compatId = parseCompatStartParam(me.start_param ?? getStartParam())
        if (compatId) {
          const joined = await startCompat(null, compatId)
          if (!alive) return
          setCompat(joined)
          if (joined.session_completed) {
            setCompatResult(joined)
            setScreen('compat-result')
          } else {
            setScreen('compat-intro')
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
      setScreen('duel-intro')
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
      const totalBefore = user?.total_score ?? 0
      const totalAfter = totalBefore + res.score
      const rankAfter = getRank(totalAfter)
      if (rankAfter.key !== getRank(totalBefore).key) setNewRank(rankAfter)
      setUser((u) =>
        u
          ? {
              ...u,
              coins: res.coins_balance ?? u.coins + res.coins_earned,
              total_score: totalAfter,
            }
          : u,
      )
      if (res.new_achievements?.length) setNewAchievements(res.new_achievements)
    } catch (e) {
      showError(e)
    }
  }, [duel, user, showError])

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

const pickCategory = useCallback(async (category, difficulty) => {
    try {
      const started = await startSolo(category, difficulty)
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
      const totalBefore = user?.total_score ?? 0
      const totalAfter = totalBefore + res.score
      const rankAfter = getRank(totalAfter)
      if (rankAfter.key !== getRank(totalBefore).key) setNewRank(rankAfter)
      setUser((u) =>
        u
          ? {
              ...u,
              coins: res.coins_balance ?? u.coins + res.coins_earned,
              total_score: totalAfter,
            }
          : u,
      )
      if (res.new_achievements?.length) setNewAchievements(res.new_achievements)
    } catch (e) {
      showError(e)
    }
  }, [solo, user, showError])

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
      const totalBefore = user?.total_score ?? 0
      const totalAfter = totalBefore + res.score
      const rankAfter = getRank(totalAfter)
      if (rankAfter.key !== getRank(totalBefore).key) setNewRank(rankAfter)
      setUser((u) =>
        u
          ? {
              ...u,
              coins: res.coins_balance ?? u.coins + res.coins_earned,
              total_score: totalAfter,
            }
          : u,
      )
      if (res.new_achievements?.length) setNewAchievements(res.new_achievements)
    } catch (e) {
      showError(e)
    }
  }, [sprint, user, showError])

  const startDailyRun = useCallback(async () => {
    setBusy(true)
    try {
      const started = await startDaily()
      setDaily(started)
      setScreen('daily-quiz')
    } catch (e) {
      showError(e)
    } finally {
      setBusy(false)
    }
  }, [showError])

  // все 5 вопросов ежедневного вызова отвечены -> считаем итог
  const completeDaily = useCallback(async () => {
    setScreen('finishing')
    try {
      const res = await finishDaily(daily.session_id)
      setDailyResult(res)
      setScreen('daily-result')
      const totalBefore = user?.total_score ?? 0
      const totalAfter = totalBefore + res.score
      const rankAfter = getRank(totalAfter)
      if (rankAfter.key !== getRank(totalBefore).key) setNewRank(rankAfter)
      setUser((u) =>
        u
          ? {
              ...u,
              coins: res.coins_balance ?? u.coins + res.coins_earned,
              total_score: totalAfter,
            }
          : u,
      )
      if (res.new_achievements?.length) setNewAchievements(res.new_achievements)
    } catch (e) {
      showError(e)
    }
  }, [daily, user, showError])

  const startMarathonRun = useCallback(async () => {
    setBusy(true)
    try {
      const started = await startMarathon()
      setMarathon(started)
      setScreen('marathon')
    } catch (e) {
      showError(e)
    } finally {
      setBusy(false)
    }
  }, [showError])

  // серия оборвалась (или пул исчерпан) -> считаем итог
  const completeMarathon = useCallback(async () => {
    setScreen('finishing')
    try {
      const res = await finishMarathon(marathon.session_id)
      setMarathonResult(res)
      setScreen('marathon-result')
      const totalBefore = user?.total_score ?? 0
      const totalAfter = totalBefore + res.score
      const rankAfter = getRank(totalAfter)
      if (rankAfter.key !== getRank(totalBefore).key) setNewRank(rankAfter)
      setUser((u) =>
        u
          ? {
              ...u,
              coins: res.coins_balance ?? u.coins + res.coins_earned,
              total_score: totalAfter,
            }
          : u,
      )
      if (res.new_achievements?.length) setNewAchievements(res.new_achievements)
    } catch (e) {
      showError(e)
    }
  }, [marathon, user, showError])

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

  const pickCompatTest = useCallback(async (testKey) => {
    try {
      const started = await startCompat(testKey, null)
      setCompat(started)
      setScreen('compat-intro')
    } catch (e) {
      showError(e)
    }
  }, [showError])

  // Пришёл сюда уже с посчитанным на сервере результатом последнего
  // ответа (answer_compat) — доп. запроса не нужно, в отличие от
  // duel/solo/sprint, где финальный счёт считает отдельный finish_*.
  const completeCompat = useCallback((res) => {
    setCompatResult(res)
    setScreen('compat-result')
  }, [])

  const pickNumerologyTest = useCallback((test) => {
    setNumerologyTest(test)
    setScreen('numerology-input')
  }, [])

  const submitNumerology = useCallback(async (testKey, day, month, year) => {
    try {
      const res = await computeNumerology(testKey, day, month, year)
      setNumerologyResult(res)
      setScreen('numerology-result')
    } catch (e) {
      showError(e)
    }
  }, [showError])

  const goHome = useCallback(async () => {
    setDuel(null)
    setResult(null)
    setSolo(null)
    setSoloResult(null)
    setSprint(null)
    setSprintResult(null)
    setDaily(null)
    setDailyResult(null)
    setMarathon(null)
    setMarathonResult(null)
    setPersona(null)
    setPersonaResult(null)
    setCompat(null)
    setCompatResult(null)
    setNumerologyTest(null)
    setNumerologyResult(null)
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
          onReport={() => {
            setReportContext({ screen: 'error', error_code: error, error_detail: errorDetail })
            setScreen('report-issue')
          }}
        />
      )

    case 'report-issue':
      return <ReportIssueScreen context={reportContext} onBack={goHome} />

    case 'force-update':
      return <ForceUpdateScreen />

    case 'settings':
      return (
        <SettingsScreen
          user={user}
          tgUser={tgUser}
          onBack={() => setScreen('profile')}
          onUpdateUser={setUser}
          onOpenPrivacy={() => setScreen('privacy')}
          onOpenTerms={() => setScreen('terms')}
          onReportIssue={() => {
            setReportContext({ screen: 'settings' })
            setScreen('report-issue')
          }}
        />
      )

    case 'shop':
      return <ShopScreen user={user} onUpdateUser={setUser} />

    case 'privacy':
      return <PrivacyPolicyScreen onBack={() => setScreen('settings')} />

    case 'terms':
      return <TermsScreen onBack={() => setScreen('settings')} />

    case 'duel-intro':
      return (
        <DuelIntroScreen
          role={duel?.role}
          onStart={() => setScreen('quiz')}
          onBack={goHome}
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
      return <LeaderboardScreen onBack={() => setScreen('profile')} />

    case 'history':
      return <HistoryScreen onBack={() => setScreen('profile')} />

    case 'achievements':
      return <AchievementsScreen onBack={() => setScreen('profile')} />

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

    case 'sprint-intro':
      return (
        <SprintIntroScreen
          onStart={startSprintRun}
          busy={busy}
          onBack={() => setScreen('home')}
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

    case 'daily-intro':
      return (
        <DailyIntroScreen
          onStart={startDailyRun}
          busy={busy}
          onBack={() => setScreen('home')}
        />
      )

    case 'daily-quiz':
      return (
        <DailyQuizScreen
          sessionId={daily.session_id}
          questions={daily.questions}
          onComplete={completeDaily}
          onError={showError}
        />
      )

    case 'daily-result':
      return <DailyResultScreen result={dailyResult} onHome={goHome} />

    case 'marathon-intro':
      return (
        <MarathonIntroScreen
          onStart={startMarathonRun}
          busy={busy}
          onBack={() => setScreen('home')}
        />
      )

    case 'marathon':
      return (
        <MarathonScreen
          sessionId={marathon.session_id}
          questions={marathon.questions}
          onComplete={completeMarathon}
          onError={showError}
        />
      )

    case 'marathon-result':
      return (
        <MarathonResultScreen
          result={marathonResult}
          onHome={goHome}
          onPlayAgain={startMarathonRun}
        />
      )

    case 'fun-hub':
      return (
        <FunHubScreen
          onPersona={() => setScreen('persona-list')}
          onCompat={() => setScreen('compat-list')}
          onNumerology={() => setScreen('numerology-list')}
        />
      )

    case 'compat-list':
      return <CompatListScreen onBack={() => setScreen('fun-hub')} onPick={pickCompatTest} />

    case 'compat-intro':
      return (
        <CompatIntroScreen
          role={compat?.role}
          title={compat?.title}
          description={compat?.description}
          onStart={() => setScreen('compat-quiz')}
          onBack={goHome}
        />
      )

    case 'compat-quiz':
      return (
        <CompatQuizScreen
          sessionId={compat.session_id}
          title={compat.title}
          questions={compat.questions}
          onComplete={completeCompat}
          onError={showError}
        />
      )

    case 'compat-result':
      return (
        <CompatResultScreen
          sessionId={compat.session_id}
          role={compat.role}
          title={compat.title}
          initial={compatResult}
          onHome={goHome}
          onPlayAgain={() => setScreen('compat-list')}
        />
      )

    case 'persona-list':
      return (
        <PersonaListScreen
          user={user}
          onUpdateUser={setUser}
          onBack={() => setScreen('fun-hub')}
          onPick={pickPersonaTest}
        />
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

    case 'numerology-list':
      return (
        <NumerologyListScreen
          user={user}
          onUpdateUser={setUser}
          onBack={() => setScreen('fun-hub')}
          onPick={pickNumerologyTest}
        />
      )

    case 'numerology-input':
      return (
        <NumerologyInputScreen
          test={numerologyTest}
          onBack={() => setScreen('numerology-list')}
          onSubmit={submitNumerology}
        />
      )

    case 'numerology-result':
      return (
        <NumerologyResultScreen
          result={numerologyResult}
          onBack={() => setScreen('numerology-list')}
          onHome={goHome}
        />
      )

    case 'profile':
      return (
        <ProfileScreen
          user={user}
          tgUser={tgUser}
          onSaveCity={saveCity}
          onEditAvatar={() => setScreen('shop')}
          onLeaderboard={() => setScreen('leaderboard')}
          onAchievements={() => setScreen('achievements')}
          onHistory={() => setScreen('history')}
          onSettings={() => setScreen('settings')}
        />
      )

    default:
      return (
        <HomeScreen
          user={user}
          tgUser={tgUser}
          busy={busy}
          onCreateDuel={createDuel}
          onQuizTests={() => setScreen('categories')}
          onSprint={() => setScreen('sprint-intro')}
          onDaily={() => setScreen('daily-intro')}
          onMarathon={() => setScreen('marathon-intro')}
          onEditAvatar={() => setScreen('shop')}
          onShop={() => setScreen('shop')}
        />
      )
  }
  })()

  // Таббар — только на 4 корневых экранах; во время игры/подэкранов
  // (даже внутри своей вкладки, например Настройки под Профилем) не
  // рендерится вовсе, а не просто прячется стилями.
  const ROOT_TABS = ['home', 'fun-hub', 'shop', 'profile']

  return (
    <>
      <div className="safe-top pointer-events-none fixed inset-x-0 top-0 z-50 mt-2 flex flex-col items-center gap-2 px-4">
        <RankUpToast rank={newRank} />
        <AchievementToast achievements={newAchievements} />
      </div>
      {content}
      {ROOT_TABS.includes(screen) && <TabBar active={screen} onChange={setScreen} />}
    </>
  )
}
