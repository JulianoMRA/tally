// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { CartaoForm } from '../CartaoForm'

describe('CartaoForm', () => {
  afterEach(cleanup)

  // A cor do cartão é a da marca. A paleta de categoria, legível nos dois temas,
  // não tem o roxo do Nubank nem o laranja do Inter: as listas são separadas
  // de propósito.
  it('continua oferecendo as cores dos bancos', () => {
    render(<CartaoForm onSalvar={vi.fn()} onCancelar={vi.fn()} />)

    // O jsdom devolve a cor do `style` inline como rgb(): #820ad1 e #ff7a00.
    expect(screen.getByRole('radio', { name: 'Roxo vivo' }).style.backgroundColor).toBe(
      'rgb(130, 10, 209)'
    )
    expect(screen.getByRole('radio', { name: 'Laranja' }).style.backgroundColor).toBe(
      'rgb(255, 122, 0)'
    )
  })
})
