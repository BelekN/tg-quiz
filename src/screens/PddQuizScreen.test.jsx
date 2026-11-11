import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import PddQuizScreen from './PddQuizScreen'

vi.mock('../lib/telegram', () => ({
  haptic: { tap: () => {}, success: () => {}, error: () => {} },
  backButton: { show: { isAvailable: () => false }, onClick: { isAvailable: () => false }, hide: { isAvailable: () => false } },
}))

const Q = [
  { id: 'a', question: 'Вопрос A', sign: '2.1', options: ['Да', 'Нет'], answer: 1, explain: 'Потому что A', order: [1, 0] },
  { id: 'b', question: 'Вопрос B', sign: null, options: ['X', 'Y', 'Z'], answer: 0, explain: 'Потому что B', order: [0, 1, 2] },
]

describe('PddQuizScreen', () => {
  it('training: shows verdict and explanation, reports score', () => {
    const onFinish = vi.fn()
    render(<PddQuizScreen session={{ mode: 'training', title: 'Тема', icon: '🔶', questions: Q }} onFinish={onFinish} onExit={() => {}} />)

    expect(screen.getByRole('img', { name: /2\.1/ })).toBeInTheDocument()
    fireEvent.click(screen.getByText('Нет'))
    expect(screen.getByText('Потому что A')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Дальше'))

    fireEvent.click(screen.getByText('Y'))
    expect(screen.getByText('✕ Не совсем')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Результат'))

    expect(onFinish).toHaveBeenCalledWith({ answers: [1, 1], correct: 1, total: 2 })
  })

  it('exam: no explanations, auto-advance, submits when time runs out', () => {
    vi.useFakeTimers()
    const onFinish = vi.fn()
    const session = {
      mode: 'exam',
      title: 'Экзамен',
      icon: '📝',
      rules: { max_errors: 2 },
      deadline: Date.now() + 60_000,
      // экзаменационный билет приходит без ответов и объяснений
      questions: Q.map(({ id, question, sign, options, order }) => ({ id, question, sign, options, order })),
    }
    render(<PddQuizScreen session={session} onFinish={onFinish} onExit={() => {}} />)

    fireEvent.click(screen.getByText('Да'))
    expect(screen.queryByText('✓ Верно!')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByText('Вопрос B')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(61_000))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].answers).toEqual([0, null])
    vi.useRealTimers()
  })
})
