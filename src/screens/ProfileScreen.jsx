import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import TabBarSpacer from '../components/TabBarSpacer'
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
    <Screen>
      {/* Градиентная "шапка" — как карточка баланса/бонусов в Wallet,
          вместо плоского фона. Очки/монеты сюда сознательно не
          дублируем (см. комментарий класса выше) — только личность. */}
      <div className="animate-rise rounded-3xl bg-gradient-to-b from-[#4fa9f5] to-[#2f6ee0] px-5 pb-6 pt-7">
        <div className="flex justify-center">
          <Avatar
            src={tgUser?.photoUrl || user?.photo_url}
            avatarKey={user?.avatar_key}
            frameKey={user?.equipped_frame}
            name={name}
            size={72}
            onClick={() => {
              haptic.tap()
              onEditAvatar()
            }}
          />
        </div>
        <p className="mt-3 truncate text-center text-[19px] font-bold text-white">{name}</p>
        {badgeLabel(user?.equipped_badge) && (
          <p className="truncate text-center text-[13px] font-semibold text-white/80">
            {badgeLabel(user.equipped_badge)}
          </p>
        )}
        {user?.city && (
          <p className="mt-0.5 truncate text-center text-xs text-white/60">📍 {user.city}</p>
        )}
      </div>

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

      <TabBarSpacer />
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
