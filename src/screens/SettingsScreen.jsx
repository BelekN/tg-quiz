import { useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import { haptic } from '../lib/telegram'
import { getHapticsEnabled, setHapticsEnabled } from '../lib/preferences'
import { setRemindersEnabled, setChallengeNotificationsEnabled, setResultNotificationsEnabled } from '../lib/api'
import { APP_VERSION } from '../lib/version'
import { t } from '../lib/i18n'

export default function SettingsScreen({
  user,
  tgUser,
  onBack,
  onUpdateUser,
  onOpenPrivacy,
  onOpenTerms,
  onReportIssue,
}) {
  const [hapticsOn, setHapticsOn] = useState(getHapticsEnabled())
  const [busyPref, setBusyPref] = useState(null)

  const toggleHaptics = () => {
    const next = !hapticsOn
    setHapticsOn(next)
    setHapticsEnabled(next)
    // Отклик сразу по включению — так сразу понятно, что заработало.
    if (next) haptic.tap()
  }

  // Общий переключатель для трёх похожих пуш-тумблеров (напоминания /
  // вызовы / результаты) — разные RPC, но одинаковая логика busy+haptic.
  const togglePref = (key, current, setter) => async () => {
    if (busyPref) return
    haptic.tap()
    setBusyPref(key)
    try {
      const res = await setter(!current)
      onUpdateUser(res.user)
    } finally {
      setBusyPref(null)
    }
  }

  const toggleReminders = togglePref('reminders', user?.reminders_enabled, setRemindersEnabled)
  const toggleChallengeNotifications = togglePref(
    'challenge',
    user?.challenge_notifications_enabled,
    setChallengeNotificationsEnabled,
  )
  const toggleResultNotifications = togglePref(
    'result',
    user?.result_notifications_enabled,
    setResultNotificationsEnabled,
  )

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">⚙️ {t('settings.title')}</h1>
      </header>

      <Section title={t('settings.section.game')}>
        <Row label={t('settings.haptics.label')} sub={t('settings.haptics.sub')}>
          <Switch checked={hapticsOn} onClick={toggleHaptics} />
        </Row>
        <Row label={t('settings.reminders.label')} sub={t('settings.reminders.sub')}>
          <Switch
            checked={user?.reminders_enabled ?? true}
            onClick={toggleReminders}
            disabled={busyPref === 'reminders'}
          />
        </Row>
        <Row label={t('settings.challenge_notifications.label')} sub={t('settings.challenge_notifications.sub')}>
          <Switch
            checked={user?.challenge_notifications_enabled ?? true}
            onClick={toggleChallengeNotifications}
            disabled={busyPref === 'challenge'}
          />
        </Row>
        <Row label={t('settings.result_notifications.label')} sub={t('settings.result_notifications.sub')}>
          <Switch
            checked={user?.result_notifications_enabled ?? true}
            onClick={toggleResultNotifications}
            disabled={busyPref === 'result'}
          />
        </Row>
      </Section>

      <Section title={t('settings.section.language')}>
        <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-tg-section px-4 py-3.5">
          <span className="text-[15px] font-medium">{t('settings.language.current')}</span>
          <span className="text-xs text-tg-hint">{t('settings.language.more_soon')}</span>
        </div>
      </Section>

      <Section title={t('settings.section.about')}>
        <LinkRow label={t('settings.report_issue')} onClick={onReportIssue} />
        <LinkRow label={t('settings.privacy')} onClick={onOpenPrivacy} />
        <LinkRow label={t('settings.terms')} onClick={onOpenTerms} />
        <div className="mt-1 flex items-center justify-between px-1 text-xs text-tg-hint">
          <span>{t('settings.version')}</span>
          <span className="tabular-nums">{APP_VERSION}</span>
        </div>
        {tgUser?.id && (
          <div className="flex items-center justify-between px-1 text-xs text-tg-hint">
            <span>{t('settings.your_id')}</span>
            <span className="tabular-nums">{tgUser.id}</span>
          </div>
        )}
      </Section>
    </Screen>
  )
}

function Section({ title, children }) {
  return (
    <section className="animate-rise mt-6">
      <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
        {title}
      </p>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

function Row({ label, sub, children }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-tg-section px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-tg-hint">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

function Switch({ checked, onClick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={checked}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-tg-accent' : 'bg-white/15'
      }`}
    >
      <span
        className={`absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function LinkRow({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-2xl border border-white/5 bg-tg-section px-4 py-3.5 text-left transition-transform active:scale-[0.98]"
    >
      <span className="text-[15px] font-medium">{label}</span>
      <span className="text-tg-hint">›</span>
    </button>
  )
}
