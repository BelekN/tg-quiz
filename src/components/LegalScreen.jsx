import Screen from './Screen'
import BackButton from './BackButton'
import { t } from '../lib/i18n'

/** Общий каркас для статичных текстовых экранов (политика, условия). */
export default function LegalScreen({ titleKey, bodyKey, onBack }) {
  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">{t(titleKey)}</h1>
      </header>
      <p className="animate-rise mt-4 whitespace-pre-line text-[14px] leading-relaxed text-tg-hint">
        {t(bodyKey)}
      </p>
    </Screen>
  )
}
