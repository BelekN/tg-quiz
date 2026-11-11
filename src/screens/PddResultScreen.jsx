import Screen from '../components/Screen'
import LessonButton from '../components/course/LessonButton'
import PddSign from '../components/pdd/PddSign'
import { pluralErrors } from '../lib/pdd'

function Mistake({ m }) {
  return (
    <div className="animate-rise rounded-2xl bg-tg-section p-4">
      <div className="flex gap-3">
        {m.sign && <PddSign sign={m.sign} size={48} className="shrink-0" />}
        <p className="text-[14px] font-semibold leading-snug">{m.question}</p>
      </div>
      {m.picked >= 0 ? (
        <p className="mt-2.5 text-[13px] leading-snug text-quiz-wrong">✕ {m.options[m.picked]}</p>
      ) : (
        <p className="mt-2.5 text-[13px] leading-snug text-tg-hint">— Нет ответа</p>
      )}
      <p className="mt-1 text-[13px] leading-snug text-quiz-right">✓ {m.options[m.answer]}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-tg-hint">{m.explain}</p>
    </div>
  )
}

/**
 * Итог ПДД. result: { mode, title, correct, total, passed?, timedOut?,
 * maxErrors?, mistakes: [{ id, question, sign, options, picked, answer, explain }] }
 * — индексы picked/answer в показанном порядке вариантов.
 */
export default function PddResultScreen({ result, busy, onAgain, onBack }) {
  const isExam = result.mode === 'exam'
  const errors = result.total - result.correct
  const perfect = errors === 0

  let icon, title, subtitle
  if (isExam) {
    if (result.timedOut) {
      icon = '⏰'
      title = 'Время вышло'
      subtitle = 'На экзамене это означает «не сдал» — в следующий раз следите за таймером'
    } else if (result.passed) {
      icon = '🎉'
      title = 'Экзамен сдан!'
      subtitle = perfect ? 'Без единой ошибки' : `${errors} ${pluralErrors(errors)} — в пределах допустимого`
    } else {
      icon = '💪'
      title = 'Не сдан'
      subtitle = `${errors} ${pluralErrors(errors)}, а можно не больше ${result.maxErrors}`
    }
  } else {
    icon = perfect ? '🏆' : errors <= 2 ? '👍' : '📖'
    title = perfect ? 'Без ошибок!' : 'Тренировка завершена'
    subtitle = perfect ? 'Тема усвоена' : 'Ниже — разбор ошибок с объяснениями'
  }

  return (
    <Screen>
      <div className="animate-pop mt-6 text-center">
        <div className="text-6xl">{icon}</div>
        <h1 className="mt-3 text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-tg-hint">{result.title}</p>
      </div>

      <div className="animate-rise mt-5 rounded-3xl border border-white/5 bg-tg-section p-5 text-center">
        <p className="text-4xl font-bold tabular-nums">
          <span className={isExam && !result.passed ? 'text-quiz-wrong' : 'text-quiz-right'}>{result.correct}</span>
          <span className="text-tg-hint"> / {result.total}</span>
        </p>
        <p className="mt-1 text-sm text-tg-hint">{subtitle}</p>
      </div>

      {result.mistakes.length > 0 && (
        <>
          <p className="mt-6 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
            Разбор ошибок · {result.mistakes.length}
          </p>
          <div className="mt-2.5 flex flex-col gap-2.5">
            {result.mistakes.map((m) => (
              <Mistake key={m.id} m={m} />
            ))}
          </div>
        </>
      )}

      <LessonButton disabled={busy} onClick={onAgain}>
        {busy ? 'Готовим…' : isExam ? 'Новый билет' : 'Пройти тему ещё раз'}
      </LessonButton>
      <div className="pt-2.5">
        <button
          type="button"
          onClick={onBack}
          className="w-full rounded-2xl bg-tg-surface px-6 py-3.5 text-[15px] font-semibold active:scale-[0.98]"
        >
          К разделу ПДД
        </button>
      </div>
    </Screen>
  )
}
