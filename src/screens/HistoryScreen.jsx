import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import Avatar from '../components/Avatar'
import BackButton from '../components/BackButton'
import { Loader, ErrorView } from '../components/StateView'
import { fetchHistory } from '../lib/api'
import { categoryMeta } from '../lib/categories'
import { formatNumber } from '../lib/format'

const OUTCOME_BADGE = {
  win: { label: 'Победа', className: 'text-quiz-right' },
  lose: { label: 'Поражение', className: 'text-quiz-wrong' },
  draw: { label: 'Ничья', className: 'text-tg-hint' },
  pending: { label: 'Ждём соперника', className: 'text-tg-accent' },
}

const dateFormatter = new Intl.DateTimeFormat('ru', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export default function HistoryScreen({ onBack }) {
  const [state, setState] = useState({ status: 'loading', items: [] })

  useEffect(() => {
    let alive = true
    fetchHistory()
      .then(({ items }) => {
        if (alive) setState({ status: 'ready', items })
      })
      .catch((e) => {
        if (alive) setState({ status: 'error', code: e.message, items: [] })
      })
    return () => {
      alive = false
    }
  }, [])

  if (state.status === 'loading') return <Loader label="Загружаем историю…" />
  if (state.status === 'error') return <ErrorView code={state.code} onRetry={onBack} />

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">📜 История игр</h1>
      </header>

      <div className="animate-rise mt-5 flex flex-col gap-2.5">
        {state.items.length === 0 && (
          <p className="mt-8 text-center text-sm text-tg-hint">
            Пока пусто — сыграйте первую партию!
          </p>
        )}

        {state.items.map((item) =>
          item.kind === 'duel' ? (
            <DuelRow key={item.id} item={item} />
          ) : item.kind === 'solo' ? (
            <SoloRow key={item.id} item={item} />
          ) : item.kind === 'persona' ? (
            <PersonaRow key={item.id} item={item} />
          ) : item.kind === 'daily' ? (
            <DailyRow key={item.id} item={item} />
          ) : item.kind === 'marathon' ? (
            <MarathonRow key={item.id} item={item} />
          ) : (
            <SprintRow key={item.id} item={item} />
          ),
        )}
      </div>
    </Screen>
  )
}

function Card({ icon, title, subtitle, score, footer }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-tg-section px-3.5 py-3">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{title}</p>
        <p className="truncate text-xs text-tg-hint">{subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[15px] font-bold tabular-nums">{score}</p>
        {footer}
      </div>
    </div>
  )
}

function DuelRow({ item }) {
  const badge = OUTCOME_BADGE[item.outcome] ?? OUTCOME_BADGE.pending
  const opponentName = item.opponent?.first_name || item.opponent?.username || 'Соперник'

  return (
    <Card
      icon={
        <Avatar
          src={item.opponent?.photo_url}
          avatarKey={item.opponent?.avatar_key}
          name={opponentName}
          size={40}
        />
      }
      title={`⚔️ vs ${item.opponent ? opponentName : '?'}`}
      subtitle={dateFormatter.format(new Date(item.happened_at))}
      score={
        item.opponent_score !== null && item.opponent_score !== undefined
          ? `${formatNumber(item.my_score)} : ${formatNumber(item.opponent_score)}`
          : formatNumber(item.my_score)
      }
      footer={<p className={`text-[11px] font-medium ${badge.className}`}>{badge.label}</p>}
    />
  )
}

function SoloRow({ item }) {
  const meta = categoryMeta(item.category)
  return (
    <Card
      icon={
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tg-accent/15 text-lg">
          {meta.icon}
        </span>
      }
      title={`🧠 ${meta.label}`}
      subtitle={dateFormatter.format(new Date(item.happened_at))}
      score={formatNumber(item.score)}
      footer={
        <p className="text-[11px] text-tg-hint">
          {item.correct}/{item.total}
        </p>
      }
    />
  )
}

function PersonaRow({ item }) {
  return (
    <Card
      icon={
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tg-accent/15 text-lg">
          🔮
        </span>
      }
      title={item.result_title}
      subtitle={`${item.test_title} · ${dateFormatter.format(new Date(item.happened_at))}`}
      score={item.icon}
    />
  )
}

function SprintRow({ item }) {
  return (
    <Card
      icon={
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tg-accent/15 text-lg">
          ⚡
        </span>
      }
      title="Спринт"
      subtitle={dateFormatter.format(new Date(item.happened_at))}
      score={formatNumber(item.score)}
      footer={<p className="text-[11px] text-tg-hint">✓ {item.correct}</p>}
    />
  )
}

function DailyRow({ item }) {
  return (
    <Card
      icon={
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tg-accent/15 text-lg">
          📅
        </span>
      }
      title="Ежедневный вызов"
      subtitle={dateFormatter.format(new Date(item.happened_at))}
      score={formatNumber(item.score)}
      footer={
        <p className="text-[11px] text-tg-hint">
          {item.correct}/{item.total}
        </p>
      }
    />
  )
}

function MarathonRow({ item }) {
  return (
    <Card
      icon={
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tg-accent/15 text-lg">
          ♾️
        </span>
      }
      title="Марафон"
      subtitle={dateFormatter.format(new Date(item.happened_at))}
      score={formatNumber(item.score)}
      footer={<p className="text-[11px] text-tg-hint">🔥 {item.correct}</p>}
    />
  )
}
