import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import Avatar from '../components/Avatar'
import { Loader, ErrorView } from '../components/StateView'
import {
  fetchShopCatalog,
  buyCosmetic,
  equipFrame,
  equipBadge,
  createStarsInvoice,
  fetchMe,
} from '../lib/api'
import { haptic, openInvoice, isInvoiceSupported } from '../lib/telegram'
import { formatNumber } from '../lib/format'

const BUY_ERROR_MESSAGES = {
  NOT_ENOUGH_COINS: 'Не хватает монет.',
  ALREADY_OWNED: 'Уже куплено.',
}

const SECTION_TITLES = {
  avatar_frame: 'Рамки аватарки',
  badge: 'Титулы у имени',
  streak_freeze: 'Расходники',
}
const SECTION_ORDER = ['avatar_frame', 'badge', 'streak_freeze']

export default function ShopScreen({ user, onUpdateUser }) {
  const [state, setState] = useState({ status: 'loading', cosmetics: [] })
  const [busyKey, setBusyKey] = useState(null)
  const [notice, setNotice] = useState(null)
  const [coinPacks, setCoinPacks] = useState([])
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, status: 'loading' }))
    fetchShopCatalog()
      .then(({ cosmetics, coin_packs }) => {
        if (alive) {
          setState({ status: 'ready', cosmetics })
          setCoinPacks(coin_packs)
        }
      })
      .catch((e) => {
        if (alive) setState({ status: 'error', code: e.message, cosmetics: [] })
      })
    return () => {
      alive = false
    }
  }, [reloadToken])

  const updateItem = (key, patch) =>
    setState((s) => ({
      ...s,
      cosmetics: s.cosmetics.map((c) => (c.key === key ? { ...c, ...patch } : c)),
    }))

  const buy = async (item) => {
    if (busyKey) return
    haptic.tap()
    setBusyKey(item.key)
    setNotice(null)
    try {
      const res = await buyCosmetic(item.key)
      onUpdateUser(res.user)
      if (item.stackable) {
        updateItem(item.key, { stock: (item.stock ?? 0) + 1 })
      } else {
        updateItem(item.key, { owned: true })
      }
      haptic.success()
    } catch (e) {
      haptic.error()
      setNotice(BUY_ERROR_MESSAGES[e.message] ?? 'Не получилось купить, попробуйте снова.')
    } finally {
      setBusyKey(null)
    }
  }

  const equip = async (item) => {
    if (busyKey) return
    haptic.tap()
    const nextKey = item.equipped ? null : item.key
    setBusyKey(item.key)
    try {
      const equipFn = item.type === 'badge' ? equipBadge : equipFrame
      const res = await equipFn(nextKey)
      onUpdateUser(res.user)
      setState((s) => ({
        ...s,
        cosmetics: s.cosmetics.map((c) =>
          c.type === item.type ? { ...c, equipped: c.key === nextKey } : c,
        ),
      }))
    } catch {
      haptic.error()
    } finally {
      setBusyKey(null)
    }
  }

  // Настоящее начисление монет приходит через вебхук Telegram, не
  // отсюда — invoice.open() тут только про UX: если статус "paid",
  // недолго опрашиваем me(), чтобы показать обновившийся баланс,
  // не заставляя перезаходить в приложение.
  const buyStars = async (pack) => {
    if (busyKey) return
    haptic.tap()
    setBusyKey(pack.key)
    setNotice(null)
    try {
      const { invoice_url } = await createStarsInvoice(pack.key)
      const status = invoice_url ? await openInvoice(invoice_url, 'url') : 'paid' // мок: invoice_url=null

      if (status === 'paid') {
        setNotice('Оплата прошла — обновляем баланс…')
        const before = user?.coins
        for (let attempt = 0; attempt < 5; attempt++) {
          await new Promise((r) => setTimeout(r, 700))
          const me = await fetchMe().catch(() => null)
          if (!me) continue
          onUpdateUser(me.user)
          if (me.user.coins !== before) break
        }
        setNotice('Готово! Монеты начислены.')
        haptic.success()
      } else if (status !== 'cancelled') {
        setNotice('Не получилось провести оплату.')
      } else {
        setNotice(null)
      }
    } catch {
      haptic.error()
      setNotice('Не получилось открыть оплату — попробуйте снова.')
    } finally {
      setBusyKey(null)
    }
  }

  if (state.status === 'loading') return <Loader label="Открываем магазин…" />
  if (state.status === 'error') {
    return <ErrorView code={state.code} onRetry={() => setReloadToken((t) => t + 1)} />
  }

  const bySection = SECTION_ORDER.map((type) => ({
    type,
    items: state.cosmetics.filter((c) => c.type === type),
  })).filter((s) => s.items.length > 0)

  return (
    <Screen className="pb-24">
      <header>
        <h1 className="text-lg font-bold">🛍 Магазин</h1>
      </header>
      <p className="mt-1 text-sm text-tg-hint">
        Баланс: <span className="font-semibold text-quiz-gold">{formatNumber(user?.coins)} монет</span>
      </p>

      {notice && (
        <p className="animate-rise mt-3 rounded-xl bg-tg-section px-3.5 py-2.5 text-center text-[13px] text-tg-text">
          {notice}
        </p>
      )}

      {bySection.map((section) => (
        <div key={section.type}>
          <p className="mt-6 mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
            {SECTION_TITLES[section.type]}
          </p>
          <div className="flex flex-col gap-2.5">
            {section.items.map((item) => (
              <CosmeticRow
                key={item.key}
                item={item}
                user={user}
                busy={busyKey === item.key}
                onBuy={() => buy(item)}
                onEquip={() => equip(item)}
              />
            ))}
          </div>
        </div>
      ))}

      <p className="mt-8 mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
        Монеты за Stars
      </p>
      {!isInvoiceSupported() && (
        <p className="mb-2 px-1 text-xs text-tg-hint">
          Оплата доступна только внутри Telegram.
        </p>
      )}
      <div className="flex flex-col gap-2.5">
        {coinPacks.map((pack) => (
          <div
            key={pack.key}
            className="flex items-center gap-3.5 rounded-2xl border border-white/5 bg-tg-section px-3.5 py-3"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-quiz-gold/15 text-xl">
              🪙
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">{pack.title}</p>
              <p className="text-xs text-tg-hint">⭐ {formatNumber(pack.stars)} Stars</p>
            </div>
            <button
              type="button"
              disabled={busyKey === pack.key || !isInvoiceSupported()}
              onClick={() => buyStars(pack)}
              className="shrink-0 rounded-xl bg-tg-accent px-3.5 py-2 text-[13px] font-semibold text-tg-accent-text active:scale-95 disabled:opacity-40"
            >
              Купить
            </button>
          </div>
        ))}
      </div>
    </Screen>
  )
}

function CosmeticRow({ item, user, busy, onBuy, onEquip }) {
  const canAfford = (user?.coins ?? 0) >= item.price_coins

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-white/5 bg-tg-section px-3.5 py-3">
      {item.type === 'avatar_frame' ? (
        <Avatar
          avatarKey={user?.avatar_key}
          src={user?.photo_url}
          frameKey={item.key}
          name={user?.first_name}
          size={44}
        />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tg-accent/15 text-xl">
          {item.type === 'badge' ? '🏷️' : '🧊'}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{item.title}</p>
        {item.stackable ? (
          <p className="text-xs text-tg-hint">
            У вас: {formatNumber(item.stock)} · {formatNumber(item.price_coins)} монет за штуку
          </p>
        ) : (
          !item.owned && <p className="text-xs text-tg-hint">{formatNumber(item.price_coins)} монет</p>
        )}
      </div>

      {item.stackable ? (
        <button
          type="button"
          disabled={busy || !canAfford}
          onClick={onBuy}
          className="shrink-0 rounded-xl bg-tg-accent px-3.5 py-2 text-[13px] font-semibold text-tg-accent-text active:scale-95 disabled:opacity-40"
        >
          Купить ещё
        </button>
      ) : item.owned ? (
        <button
          type="button"
          disabled={busy}
          onClick={onEquip}
          className={`shrink-0 rounded-xl px-3.5 py-2 text-[13px] font-semibold active:scale-95 disabled:opacity-50 ${
            item.equipped ? 'bg-tg-surface text-tg-text' : 'bg-tg-accent text-tg-accent-text'
          }`}
        >
          {item.equipped ? 'Снять' : 'Надеть'}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy || !canAfford}
          onClick={onBuy}
          className="shrink-0 rounded-xl bg-tg-accent px-3.5 py-2 text-[13px] font-semibold text-tg-accent-text active:scale-95 disabled:opacity-40"
        >
          Купить
        </button>
      )}
    </div>
  )
}
