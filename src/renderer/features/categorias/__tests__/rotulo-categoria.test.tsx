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
})
