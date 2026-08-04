// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { BalancoMensal } from '@shared/ipc/visao-mensal'
import { SaldoCard } from '../SaldoCard'

function totais(overrides: Partial<BalancoMensal> = {}): BalancoMensal {
  return {
    totalSaidasCentavos: 121820,
    totalEntradasRecebidasCentavos: 0,
    totalEntradasProjetadasCentavos: 240000,
    saldoRealizadoCentavos: -121820,
    saldoProjetadoCentavos: 118180,
    ...overrides
  }
}

describe('SaldoCard', () => {
  afterEach(cleanup)

  it('rotula a linha de apoio como "Só entradas recebidas", nunca como "Realizado"', () => {
    render(<SaldoCard totais={totais()} />)

    expect(screen.getByText(/Só entradas recebidas/)).toBeTruthy()
    expect(screen.queryByText(/^Realizado/)).toBeNull()
  })

  it('explicita no hint que saídas contam mesmo em fatura não paga', () => {
    render(<SaldoCard totais={totais()} />)

    expect(screen.getByText(/mesmo em fatura não paga/)).toBeTruthy()
  })

  it('mostra o projetado como número principal e o realizado na linha de apoio', () => {
    render(<SaldoCard totais={totais()} />)

    // Regex e não string exata: formatBRL usa espaço não-quebrável após "R$".
    expect(screen.getByText(/^R\$\s*1\.181,80$/)).toBeTruthy()
    expect(screen.getByText(/^-R\$\s*1\.218,20$/)).toBeTruthy()
  })
})
