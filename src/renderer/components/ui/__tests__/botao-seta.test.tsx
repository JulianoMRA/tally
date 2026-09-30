// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BotaoSeta } from '../BotaoSeta'

describe('BotaoSeta', () => {
  afterEach(cleanup)

  it('o rótulo nomeia o botão e vira a dica', () => {
    render(
      <BotaoSeta direcao="anterior" rotulo="Fatura anterior: agosto de 2026" onClick={vi.fn()} />
    )

    const botao = screen.getByRole('button', { name: 'Fatura anterior: agosto de 2026' })
    expect(botao.getAttribute('title')).toBe('Fatura anterior: agosto de 2026')
    expect(botao.textContent).toBe('←')
  })

  it('aponta para a direita na direção "próxima"', () => {
    render(<BotaoSeta direcao="proxima" rotulo="Próximo mês" onClick={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Próximo mês' }).textContent).toBe('→')
  })

  it('avisa o clique', async () => {
    const onClick = vi.fn()
    render(<BotaoSeta direcao="proxima" rotulo="Próximo mês" onClick={onClick} />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Próximo mês' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('desabilitado não avisa nada', async () => {
    const onClick = vi.fn()
    render(<BotaoSeta direcao="anterior" rotulo="Sem fatura anterior" onClick={onClick} disabled />)

    const botao = screen.getByRole('button', { name: 'Sem fatura anterior' }) as HTMLButtonElement
    await userEvent.setup().click(botao)

    expect(botao.disabled).toBe(true)
    expect(onClick).not.toHaveBeenCalled()
  })
})
