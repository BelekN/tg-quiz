import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import TabBarSpacer from '../components/TabBarSpacer'
import Avatar from '../components/Avatar'
import CityPrompt from '../components/CityPrompt'
import { haptic, getHomeScreenStatus, promptAddToHomeScreen } from '../lib/telegram'
import { useHeaderColor } from '../hooks/useHeaderColor'
import { badgeLabel } from '../lib/badges'

// Верхняя точка градиента шапки — тот же цвет уходит в нативную
// шапку Telegram (Close/•••) через useHeaderColor, чтобы не было
// видимого шва между нативной и веб-частью экрана.
const HEADER_TOP_COLOR = '#4fa9f5'

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

  useHeaderColor(HEADER_TOP_COLOR)

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
      {/* Градиентная "шапка" — сплошная заливка во всю ширину экрана И
          до самого верха (за плавающими Close/•••: в fullscreen-режиме
          Telegram у них нет отдельной цветной "полосы", это прозрачные
          иконки поверх нашего же контента — тонировать там нечего,
          нужно самим дотянуть фон до истинного верха). Позиционируется
          НЕ относительно своей обёртки, а от <Screen> (relative isolate
          там же) — top:0/inset-x:0 у absolute игнорируют паддинг
          родителя (safe-top/px-4), поэтому дотягивается и за них тоже.
          Высота — на полэкрана (50dvh), последняя точка градиента =
          --color-tg-bg, поэтому низ утекает в обычный фон без шва. */}
      <div
        className="absolute inset-x-0 top-0 -z-10 h-[50dvh]"
        style={{
          background: `linear-gradient(to bottom, ${HEADER_TOP_COLOR}, #2f6ee0 45%, var(--color-tg-bg) 100%)`,
        }}
        aria-hidden="true"
      />

      <div className="animate-rise flex flex-col items-center pt-6 pb-6">
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
