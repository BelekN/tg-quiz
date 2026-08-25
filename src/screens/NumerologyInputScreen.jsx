import { useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import { haptic } from '../lib/telegram'

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function isValidDate(day, month, year) {
  if (!day || !month || !year) return false
  if (month < 1 || month > 12) return false
  if (year < 1900 || year > 2026) return false
  if (day < 1 || day > DAYS_IN_MONTH[month - 1]) return false
  return true
}

export default function NumerologyInputScreen({ test, onBack, onSubmit }) {
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)

  const d = Number(day)
  const m = Number(month)
  const y = Number(year)
  const valid = isValidDate(d, m, y)

  const submit = async () => {
    setTouched(true)
    if (!valid || busy) return
    setBusy(true)
    haptic.tap()
    try {
      await onSubmit(test.key, d, m, y)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">
          {test.icon} {test.title}
        </h1>
      </header>
      <p className="mt-1 text-sm text-tg-hint">{test.description}</p>

      <div className="animate-rise mt-6 rounded-2xl border border-white/5 bg-tg-section p-4">
        <p className="mb-3 text-sm font-medium text-tg-text">Дата рождения</p>
        <div className="flex gap-2.5">
          <input
            inputMode="numeric"
            maxLength={2}
            placeholder="ДД"
            value={day}
            onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
            className="w-full rounded-xl bg-tg-bg px-3 py-3 text-center text-lg font-semibold text-tg-text outline-none"
          />
          <input
            inputMode="numeric"
            maxLength={2}
            placeholder="ММ"
            value={month}
            onChange={(e) => setMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
            className="w-full rounded-xl bg-tg-bg px-3 py-3 text-center text-lg font-semibold text-tg-text outline-none"
          />
          <input
            inputMode="numeric"
            maxLength={4}
            placeholder="ГГГГ"
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-full flex-[1.4] rounded-xl bg-tg-bg px-3 py-3 text-center text-lg font-semibold text-tg-text outline-none"
          />
        </div>
        {touched && !valid && (
          <p className="mt-2.5 text-center text-[13px] text-red-400">Проверь дату — похоже, она неверная</p>
        )}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="mt-5 w-full rounded-2xl bg-tg-accent py-3.5 text-[15px] font-semibold text-tg-accent-text active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? 'Считаем…' : 'Узнать'}
      </button>
    </Screen>
  )
}
