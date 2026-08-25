import ModeIntroScreen from '../components/ModeIntroScreen'

/**
 * Экран-приглашение перед первым вопросом. Раньше гость по ссылке
 * проваливался прямо в вопрос с таймером, не понимая правил — теперь
 * и хост, и гость сначала видят формат игры и жмут "Начали!" сами.
 */
export default function DuelIntroScreen({ role, onStart, onBack }) {
  return (
    <ModeIntroScreen
      icon="⚔️"
      title={role === 'guest' ? 'Тебя вызвали на дуэль!' : 'Дуэль создана!'}
      description="5 вопросов, 10 секунд на каждый. Больше правильных и быстрых ответов — победа."
      onStart={onStart}
      onBack={onBack}
    />
  )
}
