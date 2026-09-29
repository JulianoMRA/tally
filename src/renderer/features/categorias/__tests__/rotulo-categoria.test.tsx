// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { RotuloCategoria } from '../RotuloCategoria'

describe('RotuloCategoria', () => {
  afterEach(cleanup)

  it('mostra o nome da categoria ativa, sem selo', () => {
    render(<RotuloCategoria nome="Lazer" arquivada={false} />)

    expect(screen.getByText('Lazer')).toBeTruthy()
    expect(screen.queryByText('Arquivada')).toBeNull()
  })

  // RF-CAT-02: a despesa continua exibindo a categoria arquivada, com o
  // indicador de inativa. Antes Saídas e Busca mostravam "#7".
  it('mostra o nome da categoria arquivada com o selo "Arquivada"', () => {
    render(<RotuloCategoria nome="Viagem" arquivada />)

    expect(screen.getByText('Viagem')).toBeTruthy()
    expect(screen.getByText('Arquivada')).toBeTruthy()
  })

  // A cor é a mesma do ranking e da pizza da Visão mensal: reconhecer a
  // categoria pela cor liga as duas telas.
  it('com cor, mostra a bolinha da categoria antes do nome', () => {
    const { container } = render(<RotuloCategoria nome="Lazer" arquivada={false} cor="#8c3b2e" />)

    const bolinha = container.querySelector<HTMLElement>('[data-bolinha]')
    expect(bolinha?.style.background).toBe('rgb(140, 59, 46)')
    expect(container.textContent).toBe('Lazer')
  })

  it('sem cor, não desenha bolinha', () => {
    const { container } = render(<RotuloCategoria nome="Lazer" arquivada={false} />)

    expect(container.querySelector('[data-bolinha]')).toBeNull()
  })
})
