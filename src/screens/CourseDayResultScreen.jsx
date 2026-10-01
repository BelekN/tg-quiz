import Screen from '../components/Screen'
import LessonButton from '../components/course/LessonButton'
import { formatNumber } from '../lib/format'

/**
 * Итог дня курса. Обычный день — сколько верно, монеты, что завтра.
 * Несданный итоговый тест — разбор ошибок и пересдача сразу же
 * (сданный уводит прямо на CertificateScreen, сюда не попадает).
 */
export default function CourseDayResultScreen({ result, exam, onBackToCourse, onRetakeExam }) {
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

        <p className="mt-6 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
          Разбор ошибок
        </p>
        <div className="mt-2.5 flex flex-col gap-2.5">
          {mistakes.map((m) => (
            <div key={m.q.id} className="animate-rise rounded-2xl bg-tg-section p-4">
              <p className="text-[14px] leading-snug whitespace-pre-line">{m.q.quote}</p>
              <p className="mt-2 text-xs text-quiz-wrong">
                ✕ Твой ответ: {m.q.options[m.chosen] ?? '—'}
              </p>
              <p className="text-xs font-semibold text-quiz-right">✓ {m.q.options[m.answer]}</p>
              <p className="mt-1.5 text-[13px] leading-snug text-tg-hint">{m.explain}</p>
            </div>
          ))}
        </div>

        <LessonButton onClick={onRetakeExam}>Пересдать тест</LessonButton>
        <button
          type="button"
          onClick={onBackToCourse}
          className="mt-3 text-center text-sm font-medium text-tg-link active:opacity-70"
        >
          Вернуться к курсу
        </button>
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
