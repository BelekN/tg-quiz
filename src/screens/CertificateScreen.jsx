import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import LessonButton from '../components/course/LessonButton'
import { formatCertificateNo, formatIssuedOn } from '../lib/course'
import { formatNumber } from '../lib/format'
import { haptic, shareResultToStory } from '../lib/telegram'

/**
 * Сертификат об окончании курса. Картинка для Stories — общая
 * брендовая (как у остальных результатов, см. shareResultToStory),
 * сам сертификат идёт подписью.
 */
export default function CertificateScreen({ certificate, coinsEarned, onBack }) {
  const c = certificate

  const share = () => {
    haptic.tap()
    shareResultToStory(
      `🏅 Прошёл курс «${c.course_title}» в КвизДуэли: ${c.cards_count} уловок за ${c.total_days} дней, итоговый тест — ${c.score}/${c.exam_total}`,
    )
  }

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
      </header>

      <div className="animate-pop mt-4 rounded-[28px] bg-gradient-to-br from-quiz-gold via-amber-300 to-quiz-gold p-[3px] shadow-[0_18px_40px_-12px_rgba(245,181,68,0.45)]">
        <div className="rounded-[25px] bg-tg-section px-6 py-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-quiz-gold">Сертификат</p>
          <div className="mt-4 text-6xl">🏅</div>
          <p className="mt-4 text-xs text-tg-hint">Настоящим подтверждается, что</p>
          <p className="mt-1 text-[26px] font-bold leading-tight">{c.name}</p>
          <p className="mt-2 text-xs text-tg-hint">успешно окончил(а) курс</p>
          <p className="mt-1 text-[17px] font-semibold leading-snug">«{c.course_title}»</p>

          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white/5 py-2.5">
              <p className="text-lg font-bold tabular-nums">{c.total_days}</p>
              <p className="text-[10px] text-tg-hint">дней</p>
            </div>
            <div className="rounded-2xl bg-white/5 py-2.5">
              <p className="text-lg font-bold tabular-nums">{c.cards_count}</p>
              <p className="text-[10px] text-tg-hint">уловок</p>
            </div>
            <div className="rounded-2xl bg-white/5 py-2.5">
              <p className="text-lg font-bold tabular-nums">
                {c.score}/{c.exam_total}
              </p>
              <p className="text-[10px] text-tg-hint">тест</p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-tg-hint">
            <span>{formatCertificateNo(c.no)}</span>
            <span>{formatIssuedOn(c.issued_on)}</span>
          </div>
          <p className="mt-1 text-[11px] font-semibold text-tg-hint">КвизДуэль · Учёба</p>
        </div>
      </div>

      {coinsEarned > 0 && (
        <div className="animate-rise mt-4 flex items-center justify-between rounded-xl bg-quiz-gold/10 px-3 py-2.5">
          <span className="text-sm text-tg-hint">Награда за курс</span>
          <span className="font-bold text-quiz-gold tabular-nums">+{formatNumber(coinsEarned)}</span>
        </div>
      )}

      <LessonButton onClick={share}>📖 Поделиться в истории</LessonButton>
      <button
        type="button"
        onClick={onBack}
        className="mt-3 text-center text-sm font-medium text-tg-link active:opacity-70"
      >
        К курсу
      </button>
    </Screen>
  )
}
