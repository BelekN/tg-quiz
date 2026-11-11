import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import { Loader, ErrorView } from '../components/StateView'
import { fetchPdd } from '../lib/api'
import { haptic } from '../lib/telegram'
import { pluralAttempts, pluralErrors, pluralQuestions, topicStatus } from '../lib/pdd'

function TopicRow({ topic: t, disabled, onOpen }) {
  const progress = t.total ? Math.round((t.best_correct / t.total) * 100) : 0
  const perfect = t.attempts > 0 && t.best_correct >= t.total
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        haptic.tap()
        onOpen(t.key)
      }}
      className="rounded-2xl border border-white/5 bg-tg-section px-4 py-3.5 text-left transition-transform active:scale-[0.98] disabled:opacity-60"
    >
      <span className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/6 text-xl">{t.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-tight">{t.title}</span>
          <span className="mt-0.5 block text-xs text-tg-hint">
            {topicStatus(t)}
            {t.in_exam === false && ' · нет в экзамене'}
          </span>
        </span>
        <span className="text-tg-hint">›</span>
      </span>
      {t.attempts > 0 && (
        <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-white/8">
          <span
            className={`block h-full rounded-full ${perfect ? 'bg-quiz-gold' : 'bg-quiz-right'}`}
            style={{ width: `${progress}%` }}
          />
        </span>
      )}
    </button>
  )
}

/**
 * «Учёба» → ПДД Кыргызстана: экзамен как на теоретическом экзамене
 * (20 вопросов, 25 минут, не больше 2 ошибок) и тренировка по темам
 * с объяснением после каждого ответа. Без очков и монет — как и вся «Учёба».
 */
export default function PddScreen({ busy, onBack, onStartExam, onStartTopic }) {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let alive = true
    fetchPdd()
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch((e) => alive && setState({ status: 'error', code: e.message }))
    return () => {
      alive = false
    }
  }, [])

  if (state.status === 'loading') return <Loader label="Открываем ПДД…" />
  if (state.status === 'error') return <ErrorView code={state.code} onRetry={onBack} />

  const { exam, topics } = state.data
  const last = exam.last

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">🚗 ПДД Кыргызстана</h1>
      </header>

      <div className="animate-rise mt-4 rounded-3xl border border-white/5 bg-tg-section p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-quiz-gold/15 text-3xl">📝</span>
          <div>
            <h2 className="text-[18px] font-bold leading-tight">Экзамен</h2>
            <p className="mt-0.5 text-xs text-tg-hint">Как теоретический экзамен на права</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] font-semibold whitespace-nowrap">
          <span className="rounded-full bg-white/8 px-2.5 py-1">
            ❓ {exam.questions} {pluralQuestions(exam.questions)}
          </span>
          <span className="rounded-full bg-white/8 px-2.5 py-1">⏱ {exam.minutes} минут</span>
          <span className="rounded-full bg-white/8 px-2.5 py-1">
            ✕ до {exam.max_errors} {pluralErrors(exam.max_errors)}
          </span>
        </div>

        {exam.taken > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/5 px-2 py-2.5">
              <p className="text-[17px] font-bold tabular-nums">{exam.taken}</p>
              <p className="text-[11px] text-tg-hint">{pluralAttempts(exam.taken)}</p>
            </div>
            <div className="rounded-xl bg-white/5 px-2 py-2.5">
              <p className="text-[17px] font-bold tabular-nums text-quiz-right">{exam.passed}</p>
              <p className="text-[11px] text-tg-hint">сдано</p>
            </div>
            <div className="rounded-xl bg-white/5 px-2 py-2.5">
              <p className="text-[17px] font-bold tabular-nums">
                {exam.best}/{exam.questions}
              </p>
              <p className="text-[11px] text-tg-hint">лучший</p>
            </div>
          </div>
        )}
        {last && (
          <p className="mt-3 text-center text-xs text-tg-hint">
            Последний раз: {last.correct} из {last.total} —{' '}
            {last.passed ? (
              <span className="font-semibold text-quiz-right">сдан</span>
            ) : (
              <span className="font-semibold text-quiz-wrong">{last.timed_out ? 'время вышло' : 'не сдан'}</span>
            )}
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            haptic.tap()
            onStartExam()
          }}
          className="mt-4 w-full rounded-2xl bg-tg-accent px-6 py-3.5 text-[15px] font-semibold text-tg-accent-text active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? 'Готовим билет…' : exam.taken > 0 ? 'Сдать ещё раз' : 'Начать экзамен'}
        </button>
      </div>

      <section className="animate-rise mt-6">
        <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
          Тренировка по темам
        </p>
        <p className="mb-3 px-1 text-xs text-tg-hint">После каждого ответа — объяснение по Правилам</p>
        <div className="flex flex-col gap-2">
          {topics.map((t) => (
            <TopicRow key={t.key} topic={t} disabled={busy} onOpen={onStartTopic} />
          ))}
        </div>
      </section>

      <p className="mt-6 px-2 text-center text-[11px] leading-relaxed text-tg-hint/80">
        Вопросы составлены по Правилам дорожного движения КР для самопроверки и не являются
        официальными экзаменационными билетами. Штрафы — по Кодексу КР о правонарушениях,
        суммы могут меняться.
      </p>
    </Screen>
  )
}
