import { useState } from 'react'
import Screen from '../components/Screen'
import TabBarSpacer from '../components/TabBarSpacer'
import Avatar from '../components/Avatar'
import ModeCard from '../components/ModeCard'
import RankListModal from '../components/RankListModal'
import { haptic } from '../lib/telegram'
import { getRank } from '../lib/ranks'
import { formatNumber, pluralDays } from '../lib/format'
import { badgeLabel } from '../lib/badges'

/**
 * Вкладка «Играть» — главное действие + личная статистика на виду
 * (как баланс в Wallet), без настроек/истории/достижений — тем
 * занимается вкладка «Профиль», чтобы не дублировать.
 */
export default function HomeScreen({
  user,
  tgUser,
  onCreateDuel,
  onQuizTests,
  onSprint,
  onDaily,
  onMarathon,
  onEditAvatar,
  onShop,
  busy,
  challenges = [],
  onOpenChallenges,
}) {
  const name = tgUser?.firstName || user?.first_name || user?.username || 'Игрок'
  const rank = getRank(user?.total_score)
  const [showRanks, setShowRanks] = useState(false)

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <Avatar
          src={tgUser?.photoUrl || user?.photo_url}
          avatarKey={user?.avatar_key}
          frameKey={user?.equipped_frame}
          name={name}
          size={48}
          onClick={() => {
            haptic.tap()
            onEditAvatar()
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] font-semibold leading-tight">
            {name}
            {/* День 1 не показываем — только когда серия реально копится */}
            {user?.current_streak > 1 && (
              <span className="ml-1.5 text-xs font-normal text-tg-hint">
                🔥 {user.current_streak} {pluralDays(user.current_streak)} подряд
              </span>
            )}
          </p>
          {/* Титул и запас заморозок — на второй строке, а не в первой:
              иначе первая строка выше обычного (из-за эмодзи) и весь
              экран ниже "уезжает". Заморозки — не только в Магазине, а
              тут же, где видна сама серия: иначе после покупки не понятно,
              прошла она или нет (в Магазине это мелкая подпись под лотом). */}
          {(badgeLabel(user?.equipped_badge) || user?.streak_freezes > 0) && (
            <p className="truncate text-[12px] font-medium text-tg-accent">
              {badgeLabel(user?.equipped_badge)}
              {badgeLabel(user?.equipped_badge) && user?.streak_freezes > 0 && ' · '}
              {user?.streak_freezes > 0 && (
                <span className="font-normal text-tg-hint">🧊×{user.streak_freezes}</span>
              )}
            </p>
          )}
        </div>
        {/* Входящие вызовы — всегда на виду, даже когда их нет: список
            (с пустым состоянием) живёт на отдельном экране, а не тут же
            карточкой — вызвать могут и 10 раз подряд, разрастаться на
            главном экране это не должно. */}
        <button
          type="button"
          onClick={() => {
            haptic.tap()
            onOpenChallenges()
          }}
          className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-tg-section text-xl"
          aria-label="Входящие вызовы"
        >
          ⚔️
          {challenges.length > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-quiz-wrong px-1 text-[10px] font-bold text-white">
              {challenges.length}
            </span>
          )}
        </button>
      </header>

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

      {/* ---- главное действие: основная функция приложения ---- */}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          haptic.tap()
          onCreateDuel()
        }}
        className="animate-rise mt-7 w-full rounded-3xl bg-tg-accent px-6 py-6 text-center shadow-xl shadow-tg-accent/25 transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        <span className="block text-[20px] font-bold text-tg-accent-text">
          {busy ? 'Готовим вопросы…' : '⚔️ Создать дуэль'}
        </span>
        <span className="mt-1 block text-[13px] text-tg-accent-text/80">
          5 вопросов · 10 секунд на ответ · вызови друга
        </span>
      </button>

      {/* ---- другие режимы: все играют в общий счёт и ранг ---- */}
      <p className="mt-8 mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
        Другие режимы
      </p>
      <div className="flex flex-col gap-2.5">
        <ModeCard
          icon="📅"
          title="Ежедневный вызов"
          subtitle="Одни и те же 5 вопросов для всех, раз в день"
          iconBg="bg-orange-500/20"
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
          iconBg="bg-yellow-500/20"
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
          iconBg="bg-teal-500/20"
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
          iconBg="bg-purple-500/20"
          disabled={busy}
          onClick={() => {
            haptic.tap()
            onMarathon()
          }}
        />
      </div>

      {showRanks && (
        <RankListModal totalScore={user?.total_score} onClose={() => setShowRanks(false)} />
      )}

      <TabBarSpacer />
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
      <p className={`text-2xl font-bold tabular-nums ${accent ? 'text-quiz-gold' : ''}`}>{value}</p>
      {caption && (
        <p className="mt-0.5 truncate text-[11px] font-medium text-tg-accent">{caption}</p>
      )}
    </Tag>
  )
}
