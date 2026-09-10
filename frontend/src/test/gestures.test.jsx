import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useSwipe } from '../hooks/useSwipe.js'
import { useLongPress } from '../hooks/useLongPress.js'

function SwipeTarget({ onTap, onSwipeLeft, onSwipeRight, onLongPress }) {
  const swipe = useSwipe({ onTap, onSwipeLeft, onSwipeRight, onLongPress })
  return (
    <button type="button" data-testid="alvo" {...swipe.handlers}>
      card
    </button>
  )
}

function PressTarget({ onTap, onLongPress }) {
  const handlers = useLongPress({ onTap, onLongPress })
  return (
    <button type="button" data-testid="alvo" {...handlers}>
      hoje nao
    </button>
  )
}

const down = (el, x = 100, y = 100) => fireEvent.pointerDown(el, { clientX: x, clientY: y, button: 0, pointerId: 1 })
const move = (el, x, y = 100) => fireEvent.pointerMove(el, { clientX: x, clientY: y, pointerId: 1 })
const up = (el, x = 100, y = 100) => fireEvent.pointerUp(el, { clientX: x, clientY: y, button: 0, pointerId: 1 })

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  Element.prototype.setPointerCapture = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('gesto de virar o card', () => {
  it('conta como toque mesmo com o dedo escorregando alguns pixels', () => {
    const onTap = vi.fn()
    render(<SwipeTarget onTap={onTap} />)
    const el = screen.getByTestId('alvo')
    down(el, 100, 100)
    move(el, 108, 106)
    up(el, 108, 106)
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('conta como toque mesmo passando de 400 ms, enquanto o toque longo não dispara', () => {
    const onTap = vi.fn()
    const onLongPress = vi.fn()
    render(<SwipeTarget onTap={onTap} onLongPress={onLongPress} />)
    const el = screen.getByTestId('alvo')
    down(el)
    act(() => {
      vi.advanceTimersByTime(430)
    })
    up(el)
    expect(onLongPress).not.toHaveBeenCalled()
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('depois do toque longo disparar, soltar não vira o card', () => {
    const onTap = vi.fn()
    const onLongPress = vi.fn()
    render(<SwipeTarget onTap={onTap} onLongPress={onLongPress} />)
    const el = screen.getByTestId('alvo')
    down(el)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    up(el)
    expect(onLongPress).toHaveBeenCalledTimes(1)
    expect(onTap).not.toHaveBeenCalled()
  })

  it('deslizar para os lados avalia e não conta como toque', () => {
    const onTap = vi.fn()
    const onSwipeRight = vi.fn()
    const onSwipeLeft = vi.fn()
    render(<SwipeTarget onTap={onTap} onSwipeRight={onSwipeRight} onSwipeLeft={onSwipeLeft} />)
    const el = screen.getByTestId('alvo')
    down(el, 100, 100)
    move(el, 220, 104)
    up(el, 220, 104)
    expect(onSwipeRight).toHaveBeenCalledTimes(1)
    down(el, 220, 100)
    move(el, 90, 104)
    up(el, 90, 104)
    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
    expect(onTap).not.toHaveBeenCalled()
  })
})

describe('toque longo em "Hoje não"', () => {
  it('toque simples reagenda', () => {
    const onTap = vi.fn()
    const onLongPress = vi.fn()
    render(<PressTarget onTap={onTap} onLongPress={onLongPress} />)
    const el = screen.getByTestId('alvo')
    down(el)
    up(el)
    expect(onTap).toHaveBeenCalledTimes(1)
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('segurar abre a pausa e não reagenda', () => {
    const onTap = vi.fn()
    const onLongPress = vi.fn()
    render(<PressTarget onTap={onTap} onLongPress={onLongPress} />)
    const el = screen.getByTestId('alvo')
    down(el)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    up(el)
    expect(onLongPress).toHaveBeenCalledTimes(1)
    expect(onTap).not.toHaveBeenCalled()
  })

  it('o dedo escorregando não mata o toque', () => {
    const onTap = vi.fn()
    render(<PressTarget onTap={onTap} onLongPress={vi.fn()} />)
    const el = screen.getByTestId('alvo')
    el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 300, bottom: 60, width: 300, height: 60 })
    down(el, 100, 30)
    move(el, 114, 36)
    up(el, 114, 36)
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('soltar longe do botão não dispara nada', () => {
    const onTap = vi.fn()
    render(<PressTarget onTap={onTap} onLongPress={vi.fn()} />)
    const el = screen.getByTestId('alvo')
    el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 300, bottom: 60, width: 300, height: 60 })
    down(el, 100, 30)
    up(el, 100, 400)
    expect(onTap).not.toHaveBeenCalled()
  })
})
