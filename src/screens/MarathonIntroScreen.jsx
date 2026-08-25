import ModeIntroScreen from '../components/ModeIntroScreen'

export default function MarathonIntroScreen({ onStart, busy, onBack }) {
  return (
    <ModeIntroScreen
      icon="♾️"
      title="Марафон"
      description="Вопросы идут один за другим, без таймера — серия обрывается на первой ошибке. Цель — набрать как можно больше подряд."
      onStart={onStart}
      busy={busy}
      onBack={onBack}
    />
  )
}
