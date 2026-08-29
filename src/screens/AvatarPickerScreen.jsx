import { useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import { AVATAR_KEYS, avatarUrl } from '../lib/avatars'
import { haptic } from '../lib/telegram'

export default function AvatarPickerScreen({ currentAvatarKey, onBack, onPick }) {
  const [busyKey, setBusyKey] = useState(null)

  const pick = async (key) => {
    if (busyKey || key === currentAvatarKey) return
    haptic.tap()
    setBusyKey(key)
    try {
      await onPick(key)
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">Выбор аватарки</h1>
      </header>
      <p className="mt-1 text-sm text-tg-hint">Выберите один из {AVATAR_KEYS.length} готовых</p>

      <div className="animate-rise mt-5 grid grid-cols-3 gap-3">
        {AVATAR_KEYS.map((key) => {
          const selected = key === currentAvatarKey
          return (
            <button
              key={key}
              type="button"
              disabled={busyKey !== null}
              onClick={() => pick(key)}
              className={`relative aspect-square overflow-hidden rounded-2xl border-2 transition-transform active:scale-95 ${
                selected ? 'border-tg-accent' : 'border-transparent'
              }`}
            >
              <img src={avatarUrl(key)} alt="" className="h-full w-full object-cover" />
              {busyKey === key && (
                <span className="absolute inset-0 grid place-items-center bg-black/40">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                </span>
              )}
              {selected && (
                <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-tg-accent text-xs text-tg-accent-text">
                  ✓
                </span>
              )}
            </button>
          )
        })}
      </div>

      {currentAvatarKey && (
        <button
          type="button"
          onClick={() => pick(null)}
          disabled={busyKey !== null}
          className="mt-5 w-full rounded-2xl bg-tg-surface px-5 py-3.5 text-[15px] font-medium text-tg-text transition-transform active:scale-[0.98]"
        >
          Вернуть фото из Telegram
        </button>
      )}
    </Screen>
  )
}
