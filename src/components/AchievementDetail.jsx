import { haptic, shareResultToStory } from '../lib/telegram'

const dateFormatter = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * Полноэкранная карточка одной награды (тап по бейджу на AchievementsScreen).
 * "Поделиться" только для уже полученных — делиться незаработанным незачем.
 */
export default function AchievementDetail({ achievement, onClose }) {
  const unlocked = Boolean(achievement.unlocked_at)

  const share = () => {
    haptic.tap()
    shareResultToStory(`Получил награду «${achievement.title}» ${achievement.icon} в КвизДуэль!`)
  }

  return (
    <div className="safe-top fixed inset-0 z-50 flex flex-col bg-tg-bg">
      <div className="flex items-center px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full bg-tg-surface text-lg active:scale-95"
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
        <div
          className={`animate-pop grid h-28 w-28 place-items-center rounded-full border-2 text-6xl ${
            unlocked
              ? 'border-quiz-gold/50 bg-quiz-gold/10'
              : 'border-white/10 bg-tg-section opacity-50 grayscale'
          }`}
        >
          {achievement.icon}
        </div>
        <h1 className="animate-rise mt-5 text-xl font-bold">{achievement.title}</h1>
        <p className="mt-2 max-w-xs text-sm text-tg-hint">{achievement.description}</p>

        {achievement.progress && (
          <div className="mt-4 w-full max-w-[200px]">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-quiz-gold"
                style={{
                  width: `${Math.min(100, (achievement.progress.current / achievement.progress.target) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-1.5 text-xs font-semibold tabular-nums text-tg-hint">
              {achievement.progress.current}/{achievement.progress.target}
            </p>
          </div>
        )}

        {unlocked ? (
          <p className="mt-3 text-xs text-tg-hint">
            Получено {dateFormatter.format(new Date(achievement.unlocked_at))}
          </p>
        ) : (
          <p className="mt-3 text-xs text-tg-hint">Пока не получено</p>
        )}
      </div>

      {unlocked && (
        <div className="px-6 pb-8">
          <button
            type="button"
            onClick={share}
            className="w-full rounded-2xl bg-tg-accent px-5 py-3.5 text-[15px] font-semibold text-tg-accent-text active:scale-[0.98]"
          >
            📖 Поделиться
          </button>
        </div>
      )}
    </div>
  )
}
