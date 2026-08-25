import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import Avatar from '../components/Avatar'
import CityPrompt from '../components/CityPrompt'
import RankListModal from '../components/RankListModal'
import { haptic, getHomeScreenStatus, promptAddToHomeScreen } from '../lib/telegram'
import { getRank } from '../lib/ranks'
import { formatNumber } from '../lib/format'
import { badgeLabel } from '../lib/badges'

/**
 * Вкладка «Профиль» — всё про аккаунт: аватар/стрик/титул, очки и
 * прогресс до ранга, монеты (ведут в магазин), рейтинг/достижения/
 * история/настройки. Раньше всё это было размазано по шапке и
 * статистике главного экрана.
 */
export default function ProfileScreen({
  user,
  tgUser,
  onSaveCity,
  onEditAvatar,
  onLeaderboard,
  onAchievements,
  onHistory,
  onSettings,
  onShop,
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
    <Screen className="pb-32">
      <header className="flex items-center gap-3">
        <Avatar
          src={tgUser?.photoUrl || user?.photo_url}
          avatarKey={user?.avatar_key}
          frameKey={user?.equipped_frame}
          name={name}
          size={56}
          onClick={() => {
            haptic.tap()
            onEditAvatar()
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] font-semibold leading-tight">
            {name}
            {user?.current_streak > 1 && (
              <span className="ml-1.5 text-xs font-normal text-tg-hint">
                🔥{user.current_streak}
              </span>
            )}
          </p>
          {badgeLabel(user?.equipped_badge) && (
            <p className="truncate text-[12px] font-medium text-tg-accent">
              {badgeLabel(user.equipped_badge)}
            </p>
          )}
          {user?.city && <p className="truncate text-xs text-tg-hint">📍 {user.city}</p>}
        </div>
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
        <Stat
          label="Монеты"
          value={formatNumber(user?.coins)}
          accent
          caption="🛍 Магазин"
          onClick={() => {
            haptic.tap()
            onShop()
          }}
        />
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

      <div className="mt-8 flex flex-col gap-2.5">
        <ProfileRow icon="🏆" label="Рейтинг" onClick={onLeaderboard} />
        <ProfileRow icon="🏅" label="Достижения" onClick={onAchievements} />
        <ProfileRow icon="📜" label="История игр" onClick={onHistory} />
        <ProfileRow icon="⚙️" label="Настройки" onClick={onSettings} />
      </div>

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
      <p className={`text-xl font-bold tabular-nums ${accent ? 'text-quiz-gold' : ''}`}>{value}</p>
      {caption && (
        <p className="mt-0.5 truncate text-[11px] font-medium text-tg-accent">{caption}</p>
      )}
    </Tag>
  )
}

function ProfileRow({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic.tap()
        onClick()
      }}
      className="flex w-full items-center gap-3.5 rounded-2xl border border-white/5 bg-tg-section px-4 py-3.5 text-left transition-transform active:scale-[0.98]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tg-accent/15 text-lg">
        {icon}
      </span>
      <span className="flex-1 text-[15px] font-semibold">{label}</span>
      <span className="text-tg-hint">›</span>
    </button>
  )
}
