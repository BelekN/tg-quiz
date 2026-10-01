import LessonButton from './LessonButton'

/** Вступление дня (intro) и правило финального дня (tip) — одна разметка. */
export default function TextStep({ step, onNext }) {
  return (
    <>
      <div className="animate-rise mt-8 text-center">
        <div className="text-6xl">{step.icon}</div>
        <h1 className="mt-4 text-[22px] font-bold leading-snug">{step.title}</h1>
      </div>
      <p className="animate-rise mt-4 rounded-3xl bg-tg-section px-5 py-4 text-[15px] leading-relaxed">
        {step.text}
      </p>
      <LessonButton onClick={onNext}>{step.type === 'intro' ? 'Поехали' : 'Понятно'}</LessonButton>
    </>
  )
}
