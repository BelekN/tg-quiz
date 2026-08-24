import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import Avatar from '../components/Avatar'
import CoinBadge from '../components/CoinBadge'
import ModeCard from '../components/ModeCard'
import CityPrompt from '../components/CityPrompt'
import RankListModal from '../components/RankListModal'
import { haptic, getHomeScreenStatus, promptAddToHomeScreen } from '../lib/telegram'
import { getRank } from '../lib/ranks'
import { formatNumber } from '../lib/format'

export default function HomeScreen({
  user,
  tgUser,
  onCreateDuel,
  onLeaderboard,
  onHistory,
  onAchievements,
  onSaveCity,
  onQuizTests,
  onSprint,
  onDaily,
  onMarathon,
  onPersona,
  onEditAvatar,
  busy,
}) {
  const name = tgUser?.firstName || user?.first_name || user?.username || 'Игрок'
  const rank = getRank(user?.total_score)
  const [showHomeScreenPrompt, setShowHomeScreenPrompt] = useState(false)
  const [showRanks, setShowRanks] = useState(false)

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
            {/* День 1 не показываем — только когда серия реально копится */}
            {user?.current_streak > 1 && (
              <span className="ml-1.5 text-xs font-normal text-tg-hint">
                🔥{user.current_streak}
              </span>
            )}
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
            onAchievements()
          }}
          className="grid h-9 w-9 place-items-center rounded-full bg-tg-surface text-lg active:scale-95"
          aria-label="Достижения"
        >
          🏅
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
        <Stat
          label="Всего очков"
          value={formatNumber(user?.total_score)}
          caption={`${rank.icon} ${rank.name}`}
          onClick={() => {
            haptic.tap()
            setShowRanks(true)
          }}
        />
        <Stat label="Монеты" value={formatNumber(user?.coins)} accent />
      </div>

      {rank.next && (
        <div className="mt-2 px-1">
          <div className="h-1 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-tg-accent"
              style={{
                width: `${Math.min(100, (rank.progress.current / rank.progress.target) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-1 text-[11px] text-tg-hint">
            До ранга «{rank.next.name}» {rank.next.icon}: {formatNumber(rank.next.min - (user?.total_score ?? 0))} очков
          </p>
        </div>
      )}

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

      {/* ---- другие режимы: все играют в общий счёт и ранг ---- */}
      <p className="mt-8 mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
        Другие режимы
      </p>
      <div className="flex flex-col gap-2.5">
        <ModeCard
          icon="📅"
          title="Ежедневный вызов"
          subtitle="Одни и те же 5 вопросов для всех, раз в день"
          disabled={busy}
          onClick={() => {
            haptic.tap()
            onDaily()
          }}
        />
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
        <ModeCard
          icon="♾️"
          title="Марафон"
          subtitle={
            user?.longest_marathon_streak > 0
              ? `Рекорд: ${user.longest_marathon_streak} подряд`
              : 'Отвечай, пока не ошибёшься'
          }
          disabled={busy}
          onClick={() => {
            haptic.tap()
            onMarathon()
          }}
        />
      </div>

      {/* ---- узнай себя: отдельно, тут нет очков и рейтинга ---- */}
      <p className="mt-8 mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
        Для удовольствия
      </p>
      <button
        type="button"
        onClick={() => {
          haptic.tap()
          onPersona()
        }}
        className="flex w-full items-center gap-3.5 rounded-2xl border border-tg-accent/20 bg-gradient-to-br from-tg-accent/15 to-tg-accent/5 px-4 py-4 text-left transition-transform active:scale-[0.98]"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-tg-accent/20 text-2xl">
          🔮
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-semibold">Узнай себя</span>
          <span className="block text-xs text-tg-hint">
            20 тестов о тебе — без очков и рейтинга, просто для удовольствия
          </span>
        </span>
        <span className="text-tg-hint">→</span>
      </button>

      {showRanks && (
        <RankListModal totalScore={user?.total_score} onClose={() => setShowRanks(false)} />
      )}
    </Screen>
  )
}

function Stat({ label, value, accent, caption, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-2xl border border-white/5 bg-tg-section px-4 py-3 text-left ${
        onClick ? 'active:scale-[0.98]' : ''
      }`}
    >
      <p className="text-[11px] text-tg-hint">{label}</p>
      <p
        className={`text-xl font-bold tabular-nums ${accent ? 'text-quiz-gold' : ''}`}
      >
        {value}
      </p>
      {caption && (
        <p className="mt-0.5 truncate text-[11px] font-medium text-tg-accent">
          {caption}
        </p>
      )}
    </Tag>
  )
}
