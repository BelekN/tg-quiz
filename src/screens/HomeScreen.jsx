import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import Avatar from '../components/Avatar'
import CoinBadge from '../components/CoinBadge'
import ModeCard from '../components/ModeCard'
import CityPrompt from '../components/CityPrompt'
import { haptic, getHomeScreenStatus, promptAddToHomeScreen } from '../lib/telegram'

export default function HomeScreen({
  user,
  tgUser,
  onCreateDuel,
  onLeaderboard,
  onHistory,
  onSaveCity,
  onQuizTests,
  onSprint,
  onEditAvatar,
  busy,
}) {
  const name = tgUser?.firstName || user?.first_name || user?.username || 'Игрок'
  const [showHomeScreenPrompt, setShowHomeScreenPrompt] = useState(false)

  useEffect(() => {
    let alive = true
    getHomeScreenStatus().then((status) => {
      if (alive && status === 'missed') setShowHomeScreenPrompt(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const addHomeScreen = () => {
    haptic.tap()
    promptAddToHomeScreen()
    setShowHomeScreenPrompt(false)
  }

  return (
    <Screen>
      {/* ---- шапка: кто вошёл + баланс ---- */}
      <header className="flex items-center gap-3">
        <Avatar
          src={tgUser?.photoUrl || user?.photo_url}
          avatarKey={user?.avatar_key}
          name={name}
          onClick={() => {
            haptic.tap()
            onEditAvatar()
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-tg-hint">Привет,</p>
          <p className="truncate text-[17px] font-semibold leading-tight">
            {name}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            haptic.tap()
            onHistory()
          }}
          className="grid h-9 w-9 place-items-center rounded-full bg-tg-surface text-lg active:scale-95"
          aria-label="История"
        >
          📜
        </button>
        <button
          type="button"
          onClick={() => {
            haptic.tap()
            onLeaderboard()
          }}
          className="grid h-9 w-9 place-items-center rounded-full bg-tg-surface text-lg active:scale-95"
          aria-label="Рейтинг"
        >
          🏆
        </button>
        <CoinBadge value={user?.coins ?? 0} />
      </header>

      {user && !user.city && <CityPrompt onSave={onSaveCity} />}

      {showHomeScreenPrompt && (
        <div className="animate-rise mt-4 flex items-center gap-3 rounded-2xl border border-white/5 bg-tg-section p-3.5">
          <span className="text-2xl">📱</span>
          <p className="flex-1 text-[13px] font-medium leading-snug">
            Добавить КвизДуэль на домашний экран?
          </p>
          <button
            type="button"
            onClick={addHomeScreen}
            className="shrink-0 rounded-xl bg-tg-accent px-3 py-2 text-[13px] font-semibold text-tg-accent-text"
          >
            Добавить
          </button>
        </div>
      )}

      {/* ---- статистика ---- */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="Всего очков" value={user?.total_score ?? 0} />
        <Stat label="Монеты" value={user?.coins ?? 0} accent />
      </div>

      {/* ---- главное действие ---- */}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          haptic.tap()
          onCreateDuel()
        }}
        className="animate-rise mt-6 w-full rounded-2xl bg-tg-accent px-5 py-4 text-[16px] font-semibold text-tg-accent-text shadow-lg shadow-tg-accent/20 transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? 'Готовим вопросы…' : '⚔️  Создать дуэль'}
      </button>
      <p className="mt-2 text-center text-xs text-tg-hint">
        5 вопросов · 10 секунд на ответ
      </p>

      {/* ---- будущие режимы ---- */}
      <p className="mt-8 mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
        Другие режимы
      </p>
      <div className="flex flex-col gap-2.5">
        <ModeCard
          icon="⚡"
          title="Спринт"
          subtitle="Успей ответить на максимум за 60 секунд"
          disabled={busy}
          onClick={() => {
            haptic.tap()
            onSprint()
          }}
        />
        <ModeCard
          icon="🧠"
          title="Квиз-тесты"
          subtitle="Тематические подборки без таймера"
          onClick={() => {
            haptic.tap()
            onQuizTests()
          }}
        />
      </div>
    </Screen>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-tg-section px-4 py-3">
      <p className="text-[11px] text-tg-hint">{label}</p>
      <p
        className={`text-xl font-bold tabular-nums ${accent ? 'text-quiz-gold' : ''}`}
      >
        {value}
      </p>
    </div>
  )
}
