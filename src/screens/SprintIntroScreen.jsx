import ModeIntroScreen from '../components/ModeIntroScreen'

export default function SprintIntroScreen({ onStart, busy, onBack }) {
  return (
    <ModeIntroScreen
      icon="⚡"
      title="Спринт"
      description="60 секунд на максимум правильных ответов. Таймер запустится сразу после старта — вопросы идут один за другим, без пауз."
      onStart={onStart}
      busy={busy}
      onBack={onBack}
    />
  )
}
