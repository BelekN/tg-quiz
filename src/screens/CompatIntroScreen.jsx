import ModeIntroScreen from '../components/ModeIntroScreen'

/**
 * Как DuelIntroScreen — но для теста на совместимость: хост видит
 * описание теста, гость (пришедший по ссылке) — что его позвали.
 */
export default function CompatIntroScreen({ role, title, description, onStart, onBack }) {
  return (
    <ModeIntroScreen
      icon="💞"
      title={role === 'guest' ? 'Тебя позвали пройти тест!' : title}
      description={role === 'guest' ? `«${title}» — ${description}` : description}
      onStart={onStart}
      onBack={onBack}
    />
  )
}
