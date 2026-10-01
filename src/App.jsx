import { useCallback, useEffect, useRef, useState } from 'react'
import HomeScreen from './screens/HomeScreen'
import FunHubScreen from './screens/FunHubScreen'
import ProfileScreen from './screens/ProfileScreen'
import TabBar from './components/TabBar'
import DuelIntroScreen from './screens/DuelIntroScreen'
import QuizScreen from './screens/QuizScreen'
import ResultScreen from './screens/ResultScreen'
import LeaderboardScreen from './screens/LeaderboardScreen'
import DuelChallengesScreen from './screens/DuelChallengesScreen'
import RivalsScreen from './screens/RivalsScreen'
import PlayerProfileScreen from './screens/PlayerProfileScreen'
import HistoryScreen from './screens/HistoryScreen'
import ReferralScreen from './screens/ReferralScreen'
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
import LearnScreen from './screens/LearnScreen'
import CourseScreen from './screens/CourseScreen'
import CourseLessonScreen from './screens/CourseLessonScreen'
import CourseDayResultScreen from './screens/CourseDayResultScreen'
import CertificateScreen from './screens/CertificateScreen'
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
  challengeDuel,
  fetchDuelChallenges,
  acceptDuelChallenge,
  declineDuelChallenge,
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
  parseReferralStartParam,
  parseSourceStartParam,
  claimReferral,
  startCourseDay,
  completeCourseDay,
  parseCourseStartParam,
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
  // Метка канала (?startapp=src_<code>) — best-effort для аналитики,
  // берём клиентский start_param: initData уже восстановлена к этому
  // моменту (initTelegram() выше), а ждать подписанный ответ сервера
  // ради одного поля в payload — лишний круг сети.
  const source = parseSourceStartParam(getStartParam())
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchMe(source)
    } catch (e) {
      if ((e.message !== 'NETWORK_ERROR' && e.message !== 'OFFLINE') || attempt >= retries) throw e
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
    }
  }
}

// Финиш/сохранение результата — самый дорогой запрос: если он оборвался,
// человек терял всю сыгранную партию (или день курса). Повторяем только
// обрыв сети; бизнес-ошибку сервера (ALREADY_* и т.п.) повтор не исправит.
async function withNetworkRetry(fn, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (e) {
      if ((e.message !== 'NETWORK_ERROR' && e.message !== 'OFFLINE') || attempt >= retries) throw e
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)))
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
  // Текущий экран для async-стартов: ответ сервера мог прийти уже после
  // того, как человек ушёл назад/на другую вкладку — тогда не уводим его
  // обратно в игру. busyRef — синхронная защита от двойного тапа (state
  // busy обновляется только со следующим рендером).
  const screenRef = useRef(screen)
  useEffect(() => {
    screenRef.current = screen
  }, [screen])
  const busyRef = useRef(false)
  // Сбой на холодном старте: «повторить» должно перезапустить вход
  // целиком (с deep link и force_update), а не просто открыть главную.
  const [bootFailed, setBootFailed] = useState(false)
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
  const [duelChallenges, setDuelChallenges] = useState([]) // входящие вызовы (не отвечено)
  const [viewingPlayerTgId, setViewingPlayerTgId] = useState(null)
  const [playerProfileReturnTo, setPlayerProfileReturnTo] = useState('profile')

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

  const [courseKey, setCourseKey] = useState(null)
  const [lesson, setLesson] = useState(null) // ответ start_course_day + examOnly
  const [lessonResult, setLessonResult] = useState(null)
  const [certificate, setCertificate] = useState(null) // { ...certificate, coins_earned? }

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

        // Входящие вызовы — best-effort, отдельно от критического пути
        // запуска: карточка на Home и бейдж на табе появятся чуть позже,
        // не стоит задерживать ради них весь бутстрап.
        fetchDuelChallenges()
          .then((r) => {
            if (alive) setDuelChallenges(r.items ?? [])
          })
          .catch(() => {})

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
            setDuel({ duel_id: duelId, role: res.role ?? 'guest' })
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

        // ?startapp=course_<key> -> пуш «день курса ждёт» ведёт сразу
        // на экран курса, а не на главную вкладку
        const startCourseKey = parseCourseStartParam(me.start_param ?? getStartParam())
        if (startCourseKey) {
          setCourseKey(startCourseKey)
          setScreen('course')
          return
        }

        // ?startapp=ref_<tg_id> -> заявляем награду за приглашение (сервер
        // сам отбрасывает самоприглашение/повторный заход по той же
        // ссылке — не критично, просто продолжаем на home без награды)
        const refTgId = parseReferralStartParam(me.start_param ?? getStartParam())
        if (refTgId) {
          try {
            await claimReferral(refTgId)
            const fresh = await fetchMe()
            if (alive) setUser(fresh.user)
          } catch {
            /* SELF_REFERRAL / ALREADY_REFERRED / REFERRER_NOT_FOUND — молча пропускаем */
          }
        }

        setScreen('home')
      } catch (e) {
        if (alive) {
          setBootFailed(true)
          showError(e)
        }
      }
    })()

    return () => {
      alive = false
    }
  }, [showError])

  // Общий каркас «нажал — ждём сервер — открываем экран»: защита от
  // двойного тапа и от ответа, пришедшего после ухода с экрана.
  const runStart = useCallback(async (request, onStarted) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    const from = screenRef.current
    try {
      const started = await request()
      if (screenRef.current !== from) return
      onStarted(started)
    } catch (e) {
      if (screenRef.current === from) showError(e)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [showError])

  const createDuel = useCallback(
    () =>
      runStart(
        () => startDuel(null),
        (created) => {
          setDuel(created)
          setScreen('duel-intro')
        },
      ),
    [runStart],
  )

  // Вызвать конкретного игрока (из рейтинга или найденного по нику/ID) —
  // играю сразу, как при обычном "Создать дуэль", просто с известной целью.
  const challengeTarget = useCallback(
    (targetTgId) =>
      runStart(
        () => challengeDuel(targetTgId),
        (created) => {
          setDuel(created)
          setScreen('duel-intro')
        },
      ),
    [runStart],
  )

  // Принять входящий вызов -> сразу вопросы, как при обычном переходе
  // по ссылке-приглашению. Убираем из списка оптимистично сразу — не
  // ждём успеха, чтобы карточка не "подвисала" на Home.
  const acceptChallenge = useCallback(async (duelId) => {
    setDuelChallenges((list) => list.filter((c) => c.duel_id !== duelId))
    setBusy(true)
    try {
      const joined = await acceptDuelChallenge(duelId)
      setDuel(joined)
      setScreen('duel-intro')
    } catch (e) {
      showError(e)
    } finally {
      setBusy(false)
    }
  }, [showError])

  const declineChallenge = useCallback(async (duelId) => {
    setDuelChallenges((list) => list.filter((c) => c.duel_id !== duelId))
    try {
      await declineDuelChallenge(duelId)
    } catch {
      // не критично — если не получилось, вызов просто снова появится
      // при следующем заходе (get_duel_challenges всё ещё вернёт его)
    }
  }, [])

  // Профиль другого игрока — открывается с трёх разных экранов
  // (рейтинг/соперники/вызовы), поэтому запоминаем, куда вернуться.
  const openPlayerProfile = useCallback((tgId, returnTo) => {
    setViewingPlayerTgId(tgId)
    setPlayerProfileReturnTo(returnTo)
    setScreen('player-profile')
  }, [])

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
      const res = await withNetworkRetry(() => finishDuel(duel.duel_id))
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
          // те же +4/+2, что начисляет finish_duel (055_coin_denomination.sql)
          (progress.outcome === 'win' ? 4 : progress.outcome === 'draw' ? 2 : 0),
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
      // Все ответы уже записаны, сорвался только финиш — доводим его,
      // иначе «Продолжить дуэль» снова вело бы на этот же экран ошибки.
      if (e.message === 'ALREADY_PLAYED') {
        completeDuel()
        return
      }
      showError(e)
    }
  }, [duel, showError, completeDuel])

  const saveCity = useCallback(async (city) => {
    const res = await setCity(city)
    setUser(res.user)
  }, [])

  const pickCategory = useCallback(
    (category, difficulty) =>
      runStart(
        () => startSolo(category, difficulty),
        (started) => {
          setSolo(started)
          setScreen('solo-quiz')
        },
      ),
    [runStart],
  )

  // все вопросы соло-сессии отвечены -> считаем итог
  const completeSolo = useCallback(async () => {
    setScreen('finishing')
    try {
      const res = await withNetworkRetry(() => finishSolo(solo.session_id))
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

  const startSprintRun = useCallback(
    () =>
      runStart(startSprint, (started) => {
        setSprint(started)
        setScreen('sprint')
      }),
    [runStart],
  )

  // 60 секунд истекли (или вопросы кончились) -> считаем итог
  const completeSprint = useCallback(async () => {
    setScreen('finishing')
    try {
      const res = await withNetworkRetry(() => finishSprint(sprint.session_id))
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

  // все 5 вопросов ежедневного вызова отвечены -> считаем итог.
  // sessionId передаётся явно для случая «все ответы уже были, сорвался
  // только финиш» — тогда стейт daily ещё не успел обновиться.
  const completeDaily = useCallback(async (sessionId = daily?.session_id) => {
    setScreen('finishing')
    try {
      const res = await withNetworkRetry(() => finishDaily(sessionId))
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

  // start_daily возобновляет прерванный сегодняшний вызов (079): с того
  // вопроса, где оборвалось, или сразу к финишу, если ответы все есть.
  const startDailyRun = useCallback(
    () =>
      runStart(startDaily, (started) => {
        setDaily(started)
        if ((started.answered ?? 0) >= started.questions.length) completeDaily(started.session_id)
        else setScreen('daily-quiz')
      }),
    [runStart, completeDaily],
  )

  const startMarathonRun = useCallback(
    () =>
      runStart(startMarathon, (started) => {
        setMarathon(started)
        setScreen('marathon')
      }),
    [runStart],
  )

  // серия оборвалась (или пул исчерпан) -> считаем итог
  const completeMarathon = useCallback(async () => {
    setScreen('finishing')
    try {
      const res = await withNetworkRetry(() => finishMarathon(marathon.session_id))
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

  const pickPersonaTest = useCallback(
    (testKey) =>
      runStart(
        () => startPersona(testKey),
        (started) => {
          setPersona(started)
          setScreen('persona-quiz')
        },
      ),
    [runStart],
  )

  // result_key считаем на клиенте (см. lib/persona.js) — сервер здесь
  // только проверяет, что такой результат существует у этого теста.
  const completePersona = useCallback(async (answers) => {
    setScreen('finishing')
    try {
      const resultKey = computePersonaResult(persona.scoring, answers, persona.results)
      const res = await withNetworkRetry(() => finishPersona(persona.session_id, resultKey))
      setPersonaResult(res)
      setScreen('persona-result')
      if (res.new_achievements?.length) setNewAchievements(res.new_achievements)
    } catch (e) {
      showError(e)
    }
  }, [persona, showError])

  const pickCompatTest = useCallback(
    (testKey) =>
      runStart(
        () => startCompat(testKey, null),
        (started) => {
          setCompat(started)
          setScreen('compat-intro')
        },
      ),
    [runStart],
  )

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

  const openCourse = useCallback((key) => {
    setCourseKey(key)
    setScreen('course')
  }, [])

  // ui — подписи под тему курса (courses.ui), приходят с экрана курса
  const startLesson = useCallback(
    (key, { examOnly = false, ui = null } = {}) =>
      runStart(
        () => startCourseDay(key),
        (started) => {
          setCourseKey(key)
          setLesson({ ...started, examOnly, ui })
          setScreen('course-lesson')
        },
      ),
    [runStart],
  )

  // Сдал итоговый тест — сразу на сертификат; иначе — экран итога дня
  // (для несданного теста там разбор ошибок и пересдача).
  const completeLesson = useCallback(async ({ correct, total, ratings, examAnswers }) => {
    setScreen('finishing')
    try {
      const res = await withNetworkRetry(() =>
        completeCourseDay(lesson.course_key, lesson.day, { correct, total, ratings, examAnswers }),
      )
      if (res.coins_balance !== undefined) {
        setUser((u) => (u ? { ...u, coins: res.coins_balance } : u))
      }
      if (res.is_last && res.passed) {
        setCertificate({ ...res.certificate, coins_earned: res.coins_earned, ui: lesson.ui })
        setScreen('certificate')
      } else {
        setLessonResult(res)
        setScreen('course-done')
      }
    } catch (e) {
      showError(e)
    }
  }, [lesson, showError])

  const backToCourse = useCallback(() => {
    setLesson(null)
    setLessonResult(null)
    setCertificate(null)
    setScreen('course')
  }, [])

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
    setLesson(null)
    setLessonResult(null)
    setCertificate(null)
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
          onRetry={bootFailed ? () => window.location.reload() : goHome}
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
      return (
        <ReportIssueScreen
          context={reportContext}
          onBack={reportContext?.screen === 'settings' ? () => setScreen('settings') : goHome}
        />
      )

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
      return (
        <LeaderboardScreen
          onBack={() => setScreen('profile')}
          onChallenge={challengeTarget}
          onOpenProfile={(tgId) => openPlayerProfile(tgId, 'leaderboard')}
        />
      )

    case 'duel-challenges':
      return (
        <DuelChallengesScreen
          challenges={duelChallenges}
          onAccept={acceptChallenge}
          onDecline={declineChallenge}
          onBack={() => setScreen('home')}
          onOpenProfile={(tgId) => openPlayerProfile(tgId, 'duel-challenges')}
        />
      )

    case 'rivals':
      return (
        <RivalsScreen
          onBack={() => setScreen('profile')}
          onChallenge={challengeTarget}
          onOpenProfile={(tgId) => openPlayerProfile(tgId, 'rivals')}
        />
      )

    case 'player-profile':
      return (
        <PlayerProfileScreen
          tgId={viewingPlayerTgId}
          onBack={() => setScreen(playerProfileReturnTo)}
        />
      )

    case 'history':
      return <HistoryScreen onBack={() => setScreen('profile')} />

    case 'referral':
      return <ReferralScreen tgId={user?.tg_id} onBack={() => setScreen('profile')} />

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
          startIndex={daily.answered ?? 0}
          startCorrect={daily.correct ?? 0}
          onComplete={() => completeDaily()}
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

    case 'learn':
      return <LearnScreen onOpenCourse={openCourse} />

    case 'course':
      return (
        <CourseScreen
          courseKey={courseKey}
          busy={busy}
          onBack={() => setScreen('learn')}
          onStartDay={startLesson}
          onOpenCertificate={(cert) => {
            setCertificate(cert)
            setScreen('certificate')
          }}
        />
      )

    case 'course-lesson':
      return (
        <CourseLessonScreen
          lesson={lesson}
          examOnly={lesson.examOnly}
          onComplete={completeLesson}
          onExit={backToCourse}
        />
      )

    case 'course-done':
      return (
        <CourseDayResultScreen
          result={lessonResult}
          exam={lesson?.exam}
          onBackToCourse={backToCourse}
        />
      )

    case 'certificate':
      return (
        <CertificateScreen
          certificate={certificate}
          coinsEarned={certificate?.coins_earned}
          onBack={backToCourse}
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
          onRivals={() => setScreen('rivals')}
          onReferral={() => setScreen('referral')}
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
          challenges={duelChallenges}
          onOpenChallenges={() => setScreen('duel-challenges')}
        />
      )
  }
  })()

  // Таббар — только на 5 корневых экранах; во время игры/подэкранов
  // (даже внутри своей вкладки, например Настройки под Профилем) не
  // рендерится вовсе, а не просто прячется стилями.
  const ROOT_TABS = ['home', 'learn', 'fun-hub', 'shop', 'profile']

  return (
    <>
      <div className="safe-top pointer-events-none fixed inset-x-0 top-0 z-50 mt-2 flex flex-col items-center gap-2 px-4">
        <RankUpToast rank={newRank} />
        <AchievementToast achievements={newAchievements} />
      </div>
      {content}
      {ROOT_TABS.includes(screen) && (
        <TabBar active={screen} onChange={setScreen} pendingChallenges={duelChallenges.length} />
      )}
    </>
  )
}
