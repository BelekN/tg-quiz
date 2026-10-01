import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import { Loader, ErrorView } from '../components/StateView'
import { fetchCourse } from '../lib/api'
import { haptic } from '../lib/telegram'

const BOX_LABEL = { 1: 'Повторим скоро', 2: 'Закрепляется', 3: 'Усвоено' }

function dayState(course, day) {
  if (day <= course.days_done) return 'done'
  if (course.completed || day > course.days_done + 1) return 'locked'
  return course.available_today ? 'today' : 'tomorrow'
}

const DAY_SKIN = {
  done: { dot: 'bg-quiz-right text-black', mark: '✓', note: 'Пройден' },
  today: { dot: 'bg-tg-accent text-tg-accent-text ring-4 ring-tg-accent/25', mark: '▶', note: 'Сегодня' },
  tomorrow: { dot: 'bg-tg-surface text-tg-hint', mark: '🕐', note: 'Откроется завтра' },
  locked: { dot: 'bg-tg-surface text-tg-hint', mark: '🔒', note: '' },
}

/**
 * Экран курса: дорожка из 7 дней, кнопка текущего дня и шпаргалка —
 * уже изученные уловки с тем, насколько они усвоены (box Лейтнера).
 */
export default function CourseScreen({ courseKey, busy, onBack, onStartDay, onOpenCertificate }) {
  const [state, setState] = useState({ status: 'loading' })
  const [openCard, setOpenCard] = useState(null)

  useEffect(() => {
    let alive = true
    fetchCourse(courseKey)
      .then((course) => alive && setState({ status: 'ready', course }))
      .catch((e) => alive && setState({ status: 'error', code: e.message }))
    return () => {
      alive = false
    }
  }, [courseKey])

  if (state.status === 'loading') return <Loader label="Открываем курс…" />
  if (state.status === 'error') return <ErrorView code={state.code} onRetry={onBack} />

  const { course } = state
  const nextDay = course.days_done + 1
  const isExamDay = nextDay === course.total_days

  let cta = null
  if (course.completed) {
    cta = {
      label: '🏅 Мой сертификат',
      onClick: () => onOpenCertificate({ ...course.certificate, ui: course.ui }),
    }
  } else if (course.available_today) {
    cta = {
      label: busy
        ? 'Готовим урок…'
        : isExamDay && course.exam_attempts > 0
          ? 'Пересдать итоговый тест'
          : course.started
            ? `Начать день ${nextDay}`
            : 'Начать курс',
      onClick: () =>
        onStartDay(course.key, { examOnly: isExamDay && course.exam_attempts > 0, ui: course.ui }),
    }
  }

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">📚 Курс</h1>
      </header>

      <div className="animate-rise mt-4 rounded-3xl border border-white/5 bg-tg-section p-5 text-center">
        <div className="text-5xl">{course.icon}</div>
        <h2 className="mt-3 text-[20px] font-bold leading-tight">{course.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-tg-hint">{course.description}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-[11px] font-semibold whitespace-nowrap">
          <span className="rounded-full bg-white/8 px-2.5 py-1">⏱ 3–5 мин в день</span>
          <span className="rounded-full bg-white/8 px-2.5 py-1">📅 {course.total_days} дней</span>
          <span className="rounded-full bg-white/8 px-2.5 py-1">🏅 Сертификат</span>
        </div>
      </div>

      {cta && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            haptic.tap()
            cta.onClick()
          }}
          className="animate-rise mt-4 w-full rounded-2xl bg-tg-accent px-6 py-3.5 text-[15px] font-semibold text-tg-accent-text active:scale-[0.98] disabled:opacity-60"
        >
          {cta.label}
        </button>
      )}
      {!cta && (
        <p className="animate-rise mt-4 rounded-2xl bg-tg-section px-4 py-3 text-center text-sm text-tg-hint">
          ✅ На сегодня всё! День {nextDay} откроется завтра.
        </p>
      )}

      <section className="animate-rise mt-6">
        <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
          Программа
        </p>
        <ol className="flex flex-col">
          {course.days.map((d, i) => {
            const st = dayState(course, d.day)
            const skin = DAY_SKIN[st]
            const isLast = i === course.days.length - 1
            return (
              <li key={d.day} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${skin.dot}`}>
                    {st === 'locked' || st === 'tomorrow' ? d.day : skin.mark}
                  </span>
                  {!isLast && (
                    <span className={`w-0.5 flex-1 ${st === 'done' ? 'bg-quiz-right/50' : 'bg-white/8'}`} />
                  )}
                </div>
                <div className={`flex-1 pb-4 ${st === 'locked' ? 'opacity-50' : ''}`}>
                  <p className="text-[15px] font-semibold leading-tight">
                    День {d.day}. {d.title}
                  </p>
                  <p className="text-xs text-tg-hint">
                    {d.subtitle}
                    {skin.note && st !== 'done' ? ` · ${skin.note}` : ''}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      {course.cards.length > 0 && (
        <section className="animate-rise mt-2">
          <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
            Шпаргалка · {course.cards.length} из {course.cards_total}
          </p>
          <div className="flex flex-col gap-2">
            {course.cards.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setOpenCard(openCard === c.key ? null : c.key)}
                className="rounded-2xl bg-tg-section px-4 py-3 text-left"
              >
                <span className="flex items-center gap-3">
                  <span className="text-xl">{c.icon}</span>
                  <span className="flex-1 text-[14px] font-semibold">{c.title}</span>
                  <span className="flex gap-0.5" title={BOX_LABEL[c.box]}>
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        className={`h-1.5 w-3 rounded-full ${n <= c.box ? 'bg-quiz-right' : 'bg-white/10'}`}
                      />
                    ))}
                  </span>
                </span>
                {openCard === c.key && (
                  <span className="animate-rise mt-2 block text-[13px] leading-snug text-tg-hint">
                    {c.summary}
                    <span className="mt-1 block text-[11px] text-tg-hint/70">{BOX_LABEL[c.box]}</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}
    </Screen>
  )
}
