import ResultCard from '../components/ResultCard'
import Screen from '../components/Screen'
import { useMainButton } from '../hooks/useBottomButton'
import { categoryMeta } from '../lib/categories'
import { compatVerdict } from '../lib/compatVerdict'

const OUTCOME = {
  win: { emoji: '🏆', title: 'Победа!', color: 'text-quiz-gold' },
  lose: { emoji: '💔', title: 'Поражение', color: 'text-quiz-wrong' },
  draw: { emoji: '🤝', title: 'Ничья', color: 'text-tg-text' },
  pending: { emoji: '⏳', title: 'Ждём соперника', color: 'text-tg-accent' },
}

const ratioVerdict = (correct, total) => {
  const ratio = total > 0 ? correct / total : 0
  return ratio === 1
    ? 'Идеально! 🏆'
    : ratio >= 0.7
      ? 'Отличный результат!'
      : ratio >= 0.4
        ? 'Неплохо!'
        : 'Есть куда расти'
}

const sprintVerdict = (correct) =>
  correct >= 20 ? 'Огонь! 🔥' : correct >= 12 ? 'Отличный темп!' : correct >= 6 ? 'Неплохо!' : 'Разгоняйся дальше'

const marathonVerdict = (correct) =>
  correct >= 20
    ? 'Легендарная серия! 🏆'
    : correct >= 10
      ? 'Отличная серия!'
      : correct >= 5
        ? 'Неплохая серия!'
        : 'Тренируйся дальше'

/**
 * Тап по строке в "Истории игр" открывает тот же итог, что был на
 * финальном экране игры/теста — те же цифры/текст, без интерактивных
 * действий вроде "Реванш"/"Ещё раз" (это уже прошедшая партия).
 */
export default function HistoryDetailScreen({ item, onBack }) {
  switch (item.kind) {
    case 'duel': {
      const view = OUTCOME[item.outcome] ?? OUTCOME.pending
      return (
        <ResultCard
          icon={view.emoji}
          title={view.title}
          titleColor={view.color}
          subtitle={`${item.my_correct} из ${item.total} правильно`}
          primaryStat={{ label: 'Ваш результат', value: item.my_score }}
          rows={
            item.opponent_score !== null && item.opponent_score !== undefined
              ? [{ label: 'Соперник', value: item.opponent_score }]
              : []
          }
          secondaryAction={{ label: 'Назад', onClick: onBack }}
        />
      )
    }

    case 'solo': {
      const meta = categoryMeta(item.category)
      return (
        <ResultCard
          icon={meta.icon}
          title={ratioVerdict(item.correct, item.total)}
          subtitle={meta.label}
          primaryStat={{ label: 'Правильных ответов', value: `${item.correct}/${item.total}` }}
          rows={[{ label: 'Очки', value: item.score }]}
          coinsEarned={item.coins_earned}
          secondaryAction={{ label: 'Назад', onClick: onBack }}
        />
      )
    }

    case 'sprint':
      return (
        <ResultCard
          icon="⚡"
          title={sprintVerdict(item.correct)}
          subtitle="60 секунд позади"
          primaryStat={{ label: 'Правильных ответов', value: item.correct }}
          rows={[{ label: 'Очки', value: item.score }]}
          coinsEarned={item.coins_earned}
          secondaryAction={{ label: 'Назад', onClick: onBack }}
        />
      )

    case 'daily':
      return (
        <ResultCard
          icon="📅"
          title={ratioVerdict(item.correct, item.total)}
          subtitle="Ежедневный вызов"
          primaryStat={{ label: 'Правильных ответов', value: `${item.correct}/${item.total}` }}
          rows={[{ label: 'Очки', value: item.score }]}
          coinsEarned={item.coins_earned}
          secondaryAction={{ label: 'Назад', onClick: onBack }}
        />
      )

    case 'marathon':
      return (
        <ResultCard
          icon="♾️"
          title={marathonVerdict(item.correct)}
          subtitle="Марафон"
          primaryStat={{ label: 'Правильных подряд', value: item.correct }}
          rows={[{ label: 'Очки', value: item.score }]}
          coinsEarned={item.coins_earned}
          secondaryAction={{ label: 'Назад', onClick: onBack }}
        />
      )

    case 'persona':
      return <PersonaDetail item={item} onBack={onBack} />

    case 'compat':
      return <CompatDetail item={item} onBack={onBack} />

    default:
      return null
  }
}

function PersonaDetail({ item, onBack }) {
  useMainButton({ text: 'Назад', onClick: onBack })

  return (
    <Screen className="justify-center">
      <div className="animate-pop text-center">
        <div className="text-6xl">{item.icon}</div>
        <p className="mt-3 text-xs uppercase tracking-wider text-tg-hint">{item.test_title}</p>
        <h1 className="mt-1 text-2xl font-bold">{item.result_title}</h1>
      </div>

      <div className="animate-rise mt-7 rounded-3xl border border-white/5 bg-tg-section p-5">
        <p className="text-center text-[15px] leading-relaxed text-tg-text">{item.description}</p>
      </div>
    </Screen>
  )
}

function CompatDetail({ item, onBack }) {
  const verdict = compatVerdict(item.match_percent)
  const partnerName = item.partner?.first_name || item.partner?.username || 'Партнёр'
  useMainButton({ text: 'Назад', onClick: onBack })

  return (
    <Screen className="items-center justify-center text-center">
      <div className="text-5xl">{verdict.emoji}</div>
      <h1 className="animate-rise mt-4 text-2xl font-bold">{item.match_percent}% совпадения</h1>
      <p className="mt-1 text-sm text-tg-hint">
        {item.icon} {item.test_title} · с {partnerName}
      </p>
      <p className="mt-2 max-w-xs text-sm text-tg-hint">{verdict.text}</p>
    </Screen>
  )
}
