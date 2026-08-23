import Screen from './Screen'

export function Loader({ label = 'Загрузка…' }) {
  return (
    <Screen className="items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-tg-accent" />
      <p className="mt-4 text-sm text-tg-hint">{label}</p>
    </Screen>
  )
}

const MESSAGES = {
  NO_INIT_DATA: 'Откройте приложение внутри Telegram.',
  UNAUTHORIZED: 'Не удалось подтвердить вход через Telegram.',
  INIT_DATA_BAD_HASH: 'Подпись Telegram не совпала. Перезапустите приложение.',
  INIT_DATA_EXPIRED: 'Сессия устарела. Перезапустите приложение.',
  DUEL_NOT_FOUND: 'Дуэль не найдена — возможно, ссылка устарела.',
  DUEL_ALREADY_COMPLETED: 'Эта дуэль уже завершена.',
  DUEL_ALREADY_TAKEN: 'В эту дуэль уже играет другой соперник.',
  DUEL_IS_YOURS: 'Это ваша собственная ссылка — отправьте её другу.',
  ALREADY_PLAYED: 'Вы уже сыграли в этой дуэли.',
  NOT_ENOUGH_QUESTIONS: 'В базе пока мало вопросов.',
}

export function ErrorView({ code, onRetry, secondaryAction }) {
  return (
    <Screen className="items-center justify-center text-center">
      <div className="text-4xl">😕</div>
      <p className="mt-3 text-[15px] font-medium">
        {MESSAGES[code] ?? 'Что-то пошло не так.'}
      </p>
      <p className="mt-1 text-xs text-tg-hint">{code}</p>
      {secondaryAction && (
        <button
          type="button"
          onClick={secondaryAction.onClick}
          className="mt-6 w-full max-w-xs rounded-xl bg-tg-accent px-6 py-3 text-sm font-semibold text-tg-accent-text active:scale-[0.98]"
        >
          {secondaryAction.label}
        </button>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`w-full max-w-xs rounded-xl px-6 py-3 text-sm font-semibold active:scale-[0.98] ${
            secondaryAction
              ? 'mt-2.5 bg-tg-surface text-tg-text'
              : 'mt-6 bg-tg-accent text-tg-accent-text'
          }`}
        >
          На главную
        </button>
      )}
    </Screen>
  )
}
