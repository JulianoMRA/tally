// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { BolinhaDeCor } from '../BolinhaDeCor'

describe('BolinhaDeCor', () => {
  afterEach(cleanup)

  it('pinta com a cor recebida e fica fora da árvore de acessibilidade', () => {
    const { container } = render(<BolinhaDeCor cor="#a88454" />)

    const bolinha = container.querySelector<HTMLElement>('[data-bolinha]')
    expect(bolinha?.dataset.bolinha).toBe('cor')
    expect(bolinha?.getAttribute('aria-hidden')).toBe('true')
    expect(bolinha?.style.background).toBe('rgb(168, 132, 84)')
  })

  // Sem cor ("Fora do cartão"), o lugar fica reservado: o texto ao lado começa
  // na mesma posição que o das linhas que têm bolinha.
  it('sem cor, reserva o espaço sem pintar nada', () => {
    const { container } = render(<BolinhaDeCor />)

    const bolinha = container.querySelector<HTMLElement>('[data-bolinha]')
    expect(bolinha?.dataset.bolinha).toBe('vazia')
    expect(bolinha?.style.background).toBe('')
  })
})
