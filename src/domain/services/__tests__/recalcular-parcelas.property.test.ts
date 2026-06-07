import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { recalcularParcelasPendentes } from '../recalcular-parcelas'
import type { Parcela, StatusParcela } from '../../entities/parcela'

function parcela(numero: number, status: StatusParcela, valorCentavos: number): Parcela {
  return {
    id: numero,
    despesaId: 1,
    faturaId: null,
    numero,
    total: null,
    valorCentavos,
    dataReferencia: '2026-06-01',
    status,
    dataPagamento: status === 'Paga' ? '2026-06-10' : null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
}

describe('recalcularParcelasPendentes (propriedades)', () => {
  it('a soma das pendentes passa a ser exatamente o novo total; pagas ficam intactas', () => {
    fc.assert(
      fc.property(
        // sequencia de status (ao menos uma pendente garantida abaixo)
        fc.array(fc.constantFrom<StatusParcela>('Pendente', 'Paga'), {
          minLength: 1,
          maxLength: 24
        }),
        fc.integer({ min: 0, max: 100_000_000 }),
        (statuses, novoTotal) => {
          // Garante pelo menos uma pendente quando novoTotal > 0
          if (novoTotal > 0 && !statuses.includes('Pendente')) statuses[0] = 'Pendente'

          const original = statuses.map((s, i) => parcela(i + 1, s, 1000 + i))
          const pagasAntes = original.filter((p) => p.status === 'Paga')

          const novas = recalcularParcelasPendentes(original, novoTotal)

          const somaPendentes = novas
            .filter((p) => p.status === 'Pendente')
            .reduce((acc, p) => acc + p.valorCentavos, 0)
          expect(somaPendentes).toBe(novoTotal)

          // Pagas inalteradas (mesmo valor, mesma ordem/posicao)
          const pagasDepois = novas.filter((p) => p.status === 'Paga')
          expect(pagasDepois).toEqual(pagasAntes)

          // Nao muta o input
          expect(original.map((p) => p.valorCentavos)).toEqual(statuses.map((_, i) => 1000 + i))
        }
      )
    )
  })
})
