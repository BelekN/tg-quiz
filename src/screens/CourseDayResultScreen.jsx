import Screen from '../components/Screen'
import LessonButton from '../components/course/LessonButton'
import { formatNumber } from '../lib/format'

/**
 * Итог дня курса. Обычный день — сколько верно, монеты, что завтра.
 * Несданный итоговый тест — какие вопросы не получились (без правильных
 * ответов: сервер их не раскрывает, иначе пересдача превращалась бы в
 * списывание) и пересдача завтра. Сданный уводит прямо на CertificateScreen.
 */
export default function CourseDayResultScreen({ result, exam, onBackToCourse }) {
  if (result.is_last) {
    const mistakes = (result.results ?? [])
      .map((r, i) => ({ ...r, q: exam?.[i] }))
      .filter((r) => !r.correct && r.q)

    return (
      <Screen>
        <div className="animate-pop mt-6 text-center">
          <div className="text-6xl">💪</div>
          <h1 className="mt-3 text-2xl font-bold">Почти получилось!</h1>
          <p className="mt-1 text-sm text-tg-hint">
            {result.score} из {result.exam_total} — для сертификата нужно {result.pass_score}
          </p>
        </div>

        <p className="mt-4 rounded-2xl bg-tg-section px-4 py-3 text-center text-sm leading-relaxed">
          Пересдать можно завтра. Загляни в шпаргалку на экране курса — и
          попробуй снова: варианты ответов будут в другом порядке.
        </p>

        <p className="mt-6 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
          Где были ошибки
        </p>
        <div className="mt-2.5 flex flex-col gap-2.5">
          {mistakes.map((m) => (
            <div key={m.q.id} className="animate-rise rounded-2xl bg-tg-section p-4">
              <p className="text-[14px] leading-snug whitespace-pre-line">✕ {m.q.quote}</p>
            </div>
          ))}
        </div>

        <LessonButton onClick={onBackToCourse}>К курсу</LessonButton>
      </Screen>
    )
  }

  const { day, total_days: totalDays } = result

  return (
    <Screen className="justify-center">
      <div className="animate-pop text-center">
        <div className="text-6xl">🎉</div>
        <h1 className="mt-3 text-2xl font-bold">День {day} пройден!</h1>
        <p className="mt-1 text-sm text-tg-hint">
          {result.total > 0 ? `Практика: ${result.correct} из ${result.total} верно` : 'Отличная работа'}
        </p>
      </div>

      <div className="animate-rise mt-7 rounded-3xl border border-white/5 bg-tg-section p-5">
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: totalDays }, (_, i) => (
            <span
              key={i}
              className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                i < day ? 'bg-quiz-right text-black' : 'bg-white/8 text-tg-hint'
              }`}
            >
              {i < day ? '✓' : i + 1}
            </span>
          ))}
        </div>

        {result.next_day_title && (
          <p className="mt-4 text-center text-sm">
            Завтра: <span className="font-semibold">«{result.next_day_title}»</span>
          </p>
        )}

        <div className="mt-4 flex items-center justify-between rounded-xl bg-quiz-gold/10 px-3 py-2.5">
          <span className="text-sm text-tg-hint">Начислено монет</span>
          <span className="font-bold text-quiz-gold tabular-nums">
            +{formatNumber(result.coins_earned)}
          </span>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-tg-hint">
        Всё, что ты отметил как «забыл», вернётся в повторение уже завтра
      </p>

      <LessonButton onClick={onBackToCourse}>Отлично</LessonButton>
    </Screen>
  )
}
