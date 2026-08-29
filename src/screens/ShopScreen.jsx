import { useEffect, useState } from 'react'
import Screen from '../components/Screen'
import TabBarSpacer from '../components/TabBarSpacer'
import Avatar from '../components/Avatar'
import { Loader, ErrorView } from '../components/StateView'
import {
  fetchShopCatalog,
  buyCosmetic,
  equipFrame,
  equipBadge,
  setAvatar,
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
  avatar_image: 'Аватарки',
  avatar_frame: 'Рамки аватарки',
  badge: 'Титулы у имени',
  streak_freeze: 'Расходники',
}
const SECTION_ORDER = ['avatar_image', 'avatar_frame', 'badge', 'streak_freeze']

export default function ShopScreen({ user, onUpdateUser }) {
  const [state, setState] = useState({ status: 'loading', cosmetics: [] })
  const [busyKey, setBusyKey] = useState(null)
  const [notice, setNotice] = useState(null)
  const [coinPacks, setCoinPacks] = useState([])
  const [reloadToken, setReloadToken] = useState(0)
  const [tab, setTab] = useState('cosmetics')

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
        // stock — общий остаток заморозок, один на всех stackable-
        // товаров (не по штуке за этот конкретный пакет) — берём из
        // res.user, а не прибавляем локально: разные пакеты дают
        // разное количество (×1/×3/×5), угадывать на клиенте нечего.
        setState((s) => ({
          ...s,
          cosmetics: s.cosmetics.map((c) =>
            c.stackable ? { ...c, stock: res.user.streak_freezes } : c,
          ),
        }))
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
      const equipFn =
        item.type === 'badge' ? equipBadge : item.type === 'avatar_image' ? setAvatar : equipFrame
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
    <Screen>
      <header>
        <h1 className="text-lg font-bold">🛍 Магазин</h1>
      </header>

      {/* Крупная карточка баланса — как "Баланс" у Wallet: одно
          большое число, а не мелкая строка текста. */}
      <div className="animate-rise mt-4 rounded-3xl bg-quiz-gold/10 px-5 py-5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-quiz-gold/80">Баланс</p>
        <p className="mt-1 text-[34px] font-extrabold tabular-nums text-tg-text">
          🪙 {formatNumber(user?.coins)}
        </p>
      </div>

      {notice && (
        <p className="animate-rise mt-3 rounded-xl bg-tg-section px-3.5 py-2.5 text-center text-[13px] text-tg-text">
          {notice}
        </p>
      )}

      {/* Сегмент-переключатель — как разделы вверху Wallet: два
          состояния экрана вместо одной длинной прокрутки. */}
      <div className="mt-5 flex gap-1 rounded-2xl bg-tg-section p-1">
        {[
          { key: 'cosmetics', label: 'Косметика' },
          { key: 'coins', label: 'Монеты' },
        ].map((seg) => (
          <button
            key={seg.key}
            type="button"
            onClick={() => {
              if (tab !== seg.key) haptic.tap()
              setTab(seg.key)
            }}
            className={`flex-1 rounded-xl py-2.5 text-[14px] font-bold transition-colors ${
              tab === seg.key ? 'bg-tg-accent text-tg-accent-text' : 'text-tg-hint'
            }`}
          >
            {seg.label}
          </button>
        ))}
      </div>

      {tab === 'cosmetics' ? (
        bySection.map((section) => (
          <div key={section.type}>
            <p className="mt-6 mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-tg-hint">
              {SECTION_TITLES[section.type]}
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {section.items.map((item) => (
                <CosmeticCell
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
        ))
      ) : (
        <div className="mt-6">
          {!isInvoiceSupported() && (
            <p className="mb-3 px-1 text-xs text-tg-hint">
              Оплата доступна только внутри Telegram.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2.5">
            {coinPacks.map((pack) => (
              <button
                key={pack.key}
                type="button"
                disabled={busyKey === pack.key || !isInvoiceSupported()}
                onClick={() => buyStars(pack)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-white/5 bg-tg-section px-2 py-4 text-center active:scale-95 disabled:opacity-40"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-quiz-gold/15 text-2xl">
                  🪙
                </span>
                <span className="line-clamp-2 text-[12.5px] font-bold leading-tight">{pack.title}</span>
                <span className="text-[11px] font-semibold text-tg-hint">⭐ {formatNumber(pack.stars)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <TabBarSpacer />
    </Screen>
  )
}

function CosmeticCell({ item, user, busy, onBuy, onEquip }) {
  const canAfford = (user?.coins ?? 0) >= item.price_coins
  const locked = !item.stackable && !item.owned && !canAfford
  const disabled = busy || (item.stackable ? !canAfford : locked)

  const tap = () => {
    if (item.stackable) return onBuy()
    if (item.owned) return onEquip()
    return onBuy()
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={tap}
      className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-center transition-colors active:scale-95 disabled:opacity-40 ${
        item.equipped ? 'border-tg-accent bg-tg-accent/10' : 'border-white/5 bg-tg-section'
      }`}
    >
      {item.type === 'avatar_image' ? (
        <Avatar avatarKey={item.key} name={item.title} size={48} />
      ) : item.type === 'avatar_frame' ? (
        <Avatar
          avatarKey={user?.avatar_key}
          src={user?.photo_url}
          frameKey={item.key}
          name={user?.first_name}
          size={48}
        />
      ) : (
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-tg-accent/15 text-2xl">
          {item.type === 'badge' ? '🏷️' : '🧊'}
        </span>
      )}

      <span className="line-clamp-2 text-[12.5px] font-bold leading-tight">{item.title}</span>

      {item.stackable ? (
        <span className="text-[11px] font-semibold text-tg-hint">
          ×{formatNumber(item.stock)} · {formatNumber(item.price_coins)}
        </span>
      ) : item.owned ? (
        <span className={`text-[11px] font-bold ${item.equipped ? 'text-tg-accent' : 'text-quiz-right'}`}>
          {item.equipped ? 'Надето' : 'Куплено'}
        </span>
      ) : (
        <span className="text-[11px] font-bold text-quiz-gold">{formatNumber(item.price_coins)}</span>
      )}
    </button>
  )
}
