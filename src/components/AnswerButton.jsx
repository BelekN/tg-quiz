const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

/**
 * state: 'idle' | 'correct' | 'wrong' | 'muted'
 * 'muted' — правильный ответ уже показан, эта кнопка не при делах.
 */
export default function AnswerButton({ text, index, state, disabled, onClick }) {
  const skin = {
    idle: 'bg-tg-surface border-white/5 active:scale-[0.98]',
    correct: 'bg-quiz-right/20 border-quiz-right text-quiz-right animate-pop',
    wrong: 'bg-quiz-wrong/20 border-quiz-wrong text-quiz-wrong animate-shake',
    muted: 'bg-tg-surface/50 border-transparent text-tg-hint',
  }[state]

  const badge = {
    idle: 'bg-white/10 text-tg-hint',
    correct: 'bg-quiz-right text-black',
    wrong: 'bg-quiz-wrong text-white',
    muted: 'bg-white/5 text-tg-hint',
  }[state]

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left text-[15px] font-medium transition-all duration-200 disabled:cursor-default ${skin}`}
    >
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${badge}`}
      >
        {state === 'correct' ? '✓' : state === 'wrong' ? '✕' : LETTERS[index]}
      </span>
      <span className="flex-1">{text}</span>
    </button>
  )
}
