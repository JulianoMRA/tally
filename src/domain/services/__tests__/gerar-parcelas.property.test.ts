import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { gerarParcelas } from '../gerar-parcelas'
import type { Cartao } from '../../entities/cartao'

const cartao: Cartao = {
  id: 1,
  nome: 'Inter',
  diaFechamento: 10,
  diaVencimento: 20,
  cor: '#000000',
  ativo: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
}

describe('gerarParcelas (propriedades)', () => {
  it('a soma das parcelas bate exatamente com o valor total (sem centavo perdido)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000_000 }),
        fc.integer({ min: 1, max: 360 }),
        (valorTotalCentavos, totalParcelas) => {
          const parcelas = gerarParcelas({
            cartao,
            dataCompra: '2026-06-15',
            totalParcelas,
            valorTotalCentavos
          })
          const soma = parcelas.reduce((acc, p) => acc + p.valorCentavos, 0)
          expect(soma).toBe(valorTotalCentavos)
          expect(parcelas).toHaveLength(totalParcelas)
        }
      )
    )
  })

  it('numera sequencialmente a partir de parcelaInicial e preserva o total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 360 }),
        fc.integer({ min: 1, max: 360 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (a, b, valorTotalCentavos) => {
          const totalParcelas = Math.max(a, b)
          const parcelaInicial = Math.min(a, b)
          const parcelas = gerarParcelas({
            cartao,
            dataCompra: '2026-06-15',
            totalParcelas,
            parcelaInicial,
            valorTotalCentavos
          })
          expect(parcelas).toHaveLength(totalParcelas - parcelaInicial + 1)
          parcelas.forEach((p, i) => {
            expect(p.numero).toBe(parcelaInicial + i)
            expect(p.total).toBe(totalParcelas)
            expect(p.valorCentavos).toBeGreaterThanOrEqual(0)
          })
        }
      )
    )
  })
})
