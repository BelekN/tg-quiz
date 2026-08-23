import { useState } from 'react'
import { haptic } from '../lib/telegram'

/** Разовый запрос города — показывается, пока user.city не заполнен. */
export default function CityPrompt({ onSave }) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const submit = async () => {
    const city = value.trim()
    if (!city || saving) return
    setSaving(true)
    setFailed(false)
    try {
      await onSave(city)
      haptic.success()
    } catch {
      haptic.error()
      setFailed(true)
      setSaving(false)
    }
  }

  return (
    <div className="animate-rise mt-4 rounded-2xl border border-white/5 bg-tg-section p-3.5">
      <p className="mb-2 text-[13px] font-medium">
        📍 Укажите свой город — он появится в рейтинге
      </p>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Например, Бишкек"
          maxLength={60}
          disabled={saving}
          // text-[16px]: меньший размер провоцирует авто-зум при фокусе в мобильных WebView
          className="select-text min-w-0 flex-1 rounded-xl bg-tg-bg px-3 py-2 text-[16px] text-tg-text outline-none placeholder:text-tg-hint disabled:opacity-60"
        />
        <button
          type="button"
          disabled={!value.trim() || saving}
          onClick={submit}
          className="shrink-0 rounded-xl bg-tg-accent px-4 py-2 text-[14px] font-semibold text-tg-accent-text disabled:opacity-50"
        >
          {saving ? '…' : 'Сохранить'}
        </button>
      </div>
      {failed && (
        <p className="mt-2 text-xs text-tg-danger">
          Не получилось сохранить, попробуйте ещё раз
        </p>
      )}
    </div>
  )
}
