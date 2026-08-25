import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import Avatar from '../components/Avatar'
import CityPrompt from '../components/CityPrompt'
import { haptic, getHomeScreenStatus, promptAddToHomeScreen } from '../lib/telegram'
import { badgeLabel } from '../lib/badges'

/**
 * Вкладка «Профиль» — аватар/титул/город + доступ к Рейтингу,
 * Достижениям, Истории и Настройкам. Очки, монеты и стрик уже видны
 * на вкладке «Играть» — здесь не повторяем, чтобы не дублировать.
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
    <Screen className="pb-40">
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
          <p className="truncate text-[18px] font-semibold leading-tight">{name}</p>
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

      <div className="mt-8 flex flex-col gap-2.5">
        <ProfileRow icon="🏆" label="Рейтинг" onClick={onLeaderboard} />
        <ProfileRow icon="🏅" label="Достижения" onClick={onAchievements} />
        <ProfileRow icon="📜" label="История игр" onClick={onHistory} />
        <ProfileRow icon="⚙️" label="Настройки" onClick={onSettings} />
      </div>
    </Screen>
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
