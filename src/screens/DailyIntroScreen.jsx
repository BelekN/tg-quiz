import ModeIntroScreen from '../components/ModeIntroScreen'

export default function DailyIntroScreen({ onStart, busy }) {
  return (
    <ModeIntroScreen
      icon="📅"
      title="Ежедневный вызов"
      description="5 одних и тех же вопросов для всех сегодня. Без таймера, но только одна попытка в сутки — дальше придётся ждать завтра."
      onStart={onStart}
      busy={busy}
    />
  )
}
