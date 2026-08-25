import { Component } from 'react'
import Screen from './Screen'
import { reportIssue } from '../lib/api'

/**
 * Последний рубеж: без неё падение рендера любого экрана (например,
 * questions[index] === undefined из-за кривого ответа сервера) валит
 * всё дерево, и Mini App показывает пустой белый экран без возможности
 * восстановиться иначе как полностью закрыть и открыть приложение.
 */
export default class ErrorBoundary extends Component {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error, info) {
    console.error('Render crash', error, info)
    // Тот же канал, что и ручные "Сообщить о проблеме" — раньше крэш
    // рендера был виден только в консоли браузера пользователя, то
    // есть фактически никому. context.kind === 'crash' на сервере
    // помечает пуш иначе (💥), чтобы не путать с ручными отчётами.
    // Best-effort: если сама отправка не долетит (нет сети, initData
    // истекла) — упавший экран всё равно должен показаться.
    reportIssue(`Crash: ${error?.message ?? String(error)}`, {
      kind: 'crash',
      stack: String(error?.stack ?? '').slice(0, 1200),
      componentStack: String(info?.componentStack ?? '').slice(0, 800),
    }).catch(() => {})
  }

  render() {
    if (!this.state.crashed) return this.props.children

    return (
      <Screen className="items-center justify-center text-center">
        <div className="text-4xl">💥</div>
        <p className="mt-3 text-[15px] font-medium">Что-то пошло не так.</p>
        <p className="mt-1 text-xs text-tg-hint">Попробуйте перезапустить приложение</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-xl bg-tg-accent px-6 py-3 text-sm font-semibold text-tg-accent-text active:scale-[0.98]"
        >
          Перезапустить
        </button>
      </Screen>
    )
  }
}
