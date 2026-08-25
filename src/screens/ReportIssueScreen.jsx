import { useState } from 'react'
import Screen from '../components/Screen'
import BackButton from '../components/BackButton'
import { haptic } from '../lib/telegram'
import { reportIssue } from '../lib/api'

/**
 * "Сообщить о проблеме" — с ErrorView сюда приходят с уже заполненным
 * context (код/detail ошибки, экран), с главного экрана — без него.
 * Сервер context не обрабатывает, просто хранит рядом с текстом.
 */
export default function ReportIssueScreen({ context, onBack }) {
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('idle') // idle -> sending -> sent -> error

  const submit = async () => {
    if (!message.trim() || status === 'sending') return
    haptic.tap()
    setStatus('sending')
    try {
      await reportIssue(message.trim(), context ?? null)
      setStatus('sent')
      haptic.success()
    } catch {
      setStatus('error')
      haptic.error()
    }
  }

  if (status === 'sent') {
    return (
      <Screen className="items-center justify-center text-center">
        <div className="text-5xl">✅</div>
        <h1 className="mt-4 text-xl font-bold">Спасибо!</h1>
        <p className="mt-2 max-w-xs text-sm text-tg-hint">
          Сообщение получили — разберёмся и постараемся исправить.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-8 w-full max-w-xs rounded-2xl bg-tg-accent px-6 py-3.5 text-[15px] font-semibold text-tg-accent-text active:scale-[0.98]"
        >
          На главную
        </button>
      </Screen>
    )
  }

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="text-lg font-bold">✉️ Сообщить о проблеме</h1>
      </header>

      <p className="mt-4 text-sm text-tg-hint">
        Опишите, что пошло не так — мы разберёмся.
      </p>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Например: пропал интернет во время дуэли, приложение показало ошибку"
        rows={6}
        maxLength={2000}
        className="mt-3 w-full rounded-2xl border border-white/5 bg-tg-section p-3.5 text-[15px] text-tg-text placeholder:text-tg-hint/60 focus:outline-none focus:ring-2 focus:ring-tg-accent/40"
      />

      {status === 'error' && (
        <p className="mt-2 text-xs text-quiz-wrong">
          Не получилось отправить — проверьте интернет и попробуйте снова.
        </p>
      )}

      <button
        type="button"
        disabled={!message.trim() || status === 'sending'}
        onClick={submit}
        className="mt-4 w-full rounded-2xl bg-tg-accent px-5 py-3.5 text-[15px] font-semibold text-tg-accent-text active:scale-[0.98] disabled:opacity-50"
      >
        {status === 'sending' ? 'Отправляем…' : 'Отправить'}
      </button>
    </Screen>
  )
}
