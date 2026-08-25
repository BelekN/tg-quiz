import Screen from '../components/Screen'
import ModeCard from '../components/ModeCard'
import { haptic } from '../lib/telegram'

/**
 * Вкладка «Играть» — чисто про начать игру: главное действие +
 * список режимов. Всё «про меня» (аватар, очки, монеты, настройки)
 * переехало во вкладку «Профиль».
 */
export default function HomeScreen({
  user,
  tgUser,
  onCreateDuel,
  onQuizTests,
  onSprint,
  onDaily,
  onMarathon,
  busy,
}) {
  const name = tgUser?.firstName || user?.first_name || user?.username || 'Игрок'

  return (
    <Screen className="pb-32">
      <header>
        <p className="text-xs text-tg-hint">Привет,</p>
        <p className="text-[20px] font-bold leading-tight">
          {name}
          {/* День 1 не показываем — только когда серия реально копится */}
          {user?.current_streak > 1 && (
            <span className="ml-1.5 text-sm font-normal text-tg-hint">
              🔥{user.current_streak}
            </span>
          )}
        </p>
      </header>

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
    </Screen>
  )
}
