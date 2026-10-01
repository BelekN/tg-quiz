/**
 * Переписка в стиле Telegram — общая для теории (шаг «chat») и
 * упражнения «найди реплику с уловкой» (spot). Первый, кто пишет, —
 * слева, остальные — справа: двух сторон спора достаточно.
 *
 * marks: { [index]: 'flag' | 'right' | 'wrong' } — подсветка реплик.
 */
const MARK_SKIN = {
  flag: 'ring-2 ring-quiz-wrong bg-quiz-wrong/15',
  good: 'ring-2 ring-quiz-right bg-quiz-right/15',
  wrong: 'ring-2 ring-quiz-wrong bg-quiz-wrong/15 animate-shake',
  right: 'ring-2 ring-quiz-right bg-quiz-right/15 animate-pop',
}

export default function ChatBubbles({ messages, visible = messages.length, marks = {}, onTap, flagIcon = '🚩' }) {
  // marks: 'good' — та же метка, что 'flag', но зелёная (ui.flag_tone курса)
  const leftName = messages[0]?.name

  return (
    <div className="flex flex-col gap-2.5 rounded-3xl bg-tg-surface/60 p-3">
      {messages.slice(0, visible).map((m, i) => {
        const left = m.name === leftName
        const mark = marks[i]
        const Tag = onTap ? 'button' : 'div'
        return (
          <Tag
            key={i}
            type={onTap ? 'button' : undefined}
            onClick={onTap ? () => onTap(i) : undefined}
            className={`animate-rise flex max-w-[85%] flex-col rounded-2xl px-3.5 py-2.5 text-left transition-transform ${
              left ? 'self-start rounded-bl-md' : 'self-end rounded-br-md'
            } ${
              mark ? MARK_SKIN[mark] : left ? 'bg-tg-section' : 'bg-tg-accent/20'
            } ${onTap ? 'active:scale-[0.98]' : ''}`}
          >
            <span className={`text-xs font-semibold ${left ? 'text-tg-link' : 'text-quiz-gold'}`}>
              {m.name}
              {(mark === 'flag' || mark === 'good') && <span className="ml-1.5">{flagIcon}</span>}
            </span>
            <span className="mt-0.5 whitespace-pre-line text-[15px] leading-snug">{m.text}</span>
          </Tag>
        )
      })}
    </div>
  )
}
