import { describe, it, expect } from 'vitest'
import { selecionarParcelasParaAdiantar } from '../adiantar-parcelas'
import type { Parcela } from '../../entities/parcela'
import type { Fatura } from '../../entities/fatura'

function fatura(
  id: number,
  mes: string,
  status: Fatura['status'] = { kind: 'Aberta' },
  cartaoId = 1
): Fatura {
  return {
    id,
    cartaoId,
    mesReferencia: mes,
    dataFechamento: `${mes}-15`,
    dataVencimento: `${mes}-22`,
    status,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
}

function parcela(
  id: number,
  numero: number,
  total: number,
  faturaId: number,
  despesaId = 1
): Parcela {
  return {
    id,
    despesaId,
    faturaId,
    numero,
    total,
    valorCentavos: 1000,
    dataReferencia: '2026-05',
    status: 'Pendente',
    dataPagamento: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
}

describe('selecionarParcelasParaAdiantar (RN-03)', () => {
  describe('seleção básica', () => {
    it('seleciona as N parcelas com maior número (mais futuras)', () => {
      // parcelas 1..5 em faturas diferentes; adiantar 2 → pega 4 e 5
      const faturas = new Map<number, Fatura>([
        [10, fatura(10, '2026-05')],
        [11, fatura(11, '2026-06')],
        [12, fatura(12, '2026-07')],
        [13, fatura(13, '2026-08')],
        [14, fatura(14, '2026-09')]
      ])
      const destino = fatura(99, '2026-04')
      const parcelas = [
        parcela(1, 1, 5, 10),
        parcela(2, 2, 5, 11),
        parcela(3, 3, 5, 12),
        parcela(4, 4, 5, 13),
        parcela(5, 5, 5, 14)
      ]

      const resultado = selecionarParcelasParaAdiantar(parcelas, faturas, 2, destino)

      expect(resultado.mover).toHaveLength(2)
      const numeros = resultado.mover.map((p) => p.numero).sort((a, b) => a - b)
      expect(numeros).toEqual([4, 5])
    })

    it('seleciona 1 parcela corretamente', () => {
      const faturas = new Map<number, Fatura>([
        [10, fatura(10, '2026-05')],
        [11, fatura(11, '2026-06')]
      ])
      const destino = fatura(99, '2026-04')
      const parcelas = [parcela(1, 1, 2, 10), parcela(2, 2, 2, 11)]

      const resultado = selecionarParcelasParaAdiantar(parcelas, faturas, 1, destino)

      expect(resultado.mover).toHaveLength(1)
      expect(resultado.mover[0].numero).toBe(2)
    })

    it('pode selecionar todas as parcelas', () => {
      const faturas = new Map<number, Fatura>([[10, fatura(10, '2026-05')]])
      const destino = fatura(99, '2026-04')
      const parcelas = [parcela(1, 1, 1, 10)]

      const resultado = selecionarParcelasParaAdiantar(parcelas, faturas, 1, destino)

      expect(resultado.mover).toHaveLength(1)
    })
  })

  describe('filtragem de elegíveis', () => {
    it('ignora parcelas já na fatura destino', () => {
      const faturas = new Map<number, Fatura>([
        [10, fatura(10, '2026-05')],
        [99, fatura(99, '2026-06')]
      ])
      const destino = fatura(99, '2026-06')
      const parcelas = [
        parcela(1, 1, 3, 10),
        parcela(2, 2, 3, 99), // já está no destino
        parcela(3, 3, 3, 10)
      ]

      const resultado = selecionarParcelasParaAdiantar(parcelas, faturas, 2, destino)

      // elegíveis são 1 e 3 (não a 2); adiantando 2 → pega ambas
      expect(resultado.mover).toHaveLength(2)
      const numeros = resultado.mover.map((p) => p.numero).sort((a, b) => a - b)
      expect(numeros).toEqual([1, 3])
    })

    it('ignora parcelas de faturas com status Paga', () => {
      const faturas = new Map<number, Fatura>([
        [10, fatura(10, '2026-04', { kind: 'Paga', pagaEm: '2026-05-01' })],
        [11, fatura(11, '2026-05')],
        [12, fatura(12, '2026-06')]
      ])
      const destino = fatura(99, '2026-07')
      const parcelas = [
        parcela(1, 1, 3, 10), // paga — inelegível
        parcela(2, 2, 3, 11),
        parcela(3, 3, 3, 12)
      ]

      const resultado = selecionarParcelasParaAdiantar(parcelas, faturas, 2, destino)

      expect(resultado.mover).toHaveLength(2)
      const numeros = resultado.mover.map((p) => p.numero).sort((a, b) => a - b)
      expect(numeros).toEqual([2, 3])
    })

    it('ignora parcelas de faturas com status Fechada', () => {
      const faturas = new Map<number, Fatura>([
        [10, fatura(10, '2026-04', { kind: 'Fechada' })],
        [11, fatura(11, '2026-05')]
      ])
      const destino = fatura(99, '2026-06')
      const parcelas = [
        parcela(1, 1, 2, 10), // fechada — inelegível
        parcela(2, 2, 2, 11)
      ]

      const resultado = selecionarParcelasParaAdiantar(parcelas, faturas, 1, destino)

      expect(resultado.mover).toHaveLength(1)
      expect(resultado.mover[0].numero).toBe(2)
    })
  })

  describe('casos de insuficiência', () => {
    it('retorna motivo "insuficientes" se há menos elegíveis que a quantidade pedida', () => {
      const faturas = new Map<number, Fatura>([[10, fatura(10, '2026-05')]])
      const destino = fatura(99, '2026-04')
      const parcelas = [parcela(1, 1, 3, 10)]

      const resultado = selecionarParcelasParaAdiantar(parcelas, faturas, 3, destino)

      expect(resultado.razao).toBe('insuficientes')
    })

    it('retorna todas as elegíveis disponíveis mesmo quando há insuficiência', () => {
      const faturas = new Map<number, Fatura>([
        [10, fatura(10, '2026-05')],
        [11, fatura(11, '2026-06')]
      ])
      const destino = fatura(99, '2026-04')
      const parcelas = [parcela(1, 1, 5, 10), parcela(2, 2, 5, 11)]

      const resultado = selecionarParcelasParaAdiantar(parcelas, faturas, 5, destino)

      expect(resultado.razao).toBe('insuficientes')
      expect(resultado.mover).toHaveLength(2)
    })

    it('retorna razão "insuficientes" se não há nenhuma parcela elegível', () => {
      const faturas = new Map<number, Fatura>([
        [10, fatura(10, '2026-04', { kind: 'Paga', pagaEm: '2026-05-01' })]
      ])
      const destino = fatura(99, '2026-05')
      const parcelas = [parcela(1, 1, 1, 10)]

      const resultado = selecionarParcelasParaAdiantar(parcelas, faturas, 1, destino)

      expect(resultado.razao).toBe('insuficientes')
      expect(resultado.mover).toHaveLength(0)
    })
  })

  describe('validações de entrada', () => {
    it('lança erro se fatura destino tem status Paga', () => {
      const faturas = new Map<number, Fatura>([[10, fatura(10, '2026-05')]])
      const destinoPago = fatura(99, '2026-04', { kind: 'Paga', pagaEm: '2026-05-01' })
      const parcelas = [parcela(1, 1, 1, 10)]

      expect(() => selecionarParcelasParaAdiantar(parcelas, faturas, 1, destinoPago)).toThrow()
    })

    it('lança erro se fatura destino tem status Fechada (RN-06: fatura fechada é imutável)', () => {
      const faturas = new Map<number, Fatura>([[10, fatura(10, '2026-05')]])
      const destinoFechado = fatura(99, '2026-04', { kind: 'Fechada' })
      const parcelas = [parcela(1, 1, 1, 10)]

      expect(() => selecionarParcelasParaAdiantar(parcelas, faturas, 1, destinoFechado)).toThrow(
        /fechada/i
      )
    })

    it('parcela Paga não é elegível mesmo em fatura Aberta', () => {
      const faturas = new Map<number, Fatura>([
        [10, fatura(10, '2026-05')],
        [11, fatura(11, '2026-06')]
      ])
      const destino = fatura(99, '2026-04')
      const paga: Parcela = { ...parcela(1, 1, 2, 10), status: 'Paga', dataPagamento: '2026-05-01' }
      const pendente = parcela(2, 2, 2, 11)

      const resultado = selecionarParcelasParaAdiantar([paga, pendente], faturas, 2, destino)

      expect(resultado.mover.map((p) => p.id)).toEqual([2])
      expect(resultado.razao).toBe('insuficientes')
    })

    it('lança erro se quantidade <= 0', () => {
      const faturas = new Map<number, Fatura>([[10, fatura(10, '2026-05')]])
      const destino = fatura(99, '2026-04')
      const parcelas = [parcela(1, 1, 1, 10)]

      expect(() => selecionarParcelasParaAdiantar(parcelas, faturas, 0, destino)).toThrow()
    })
  })

  describe('preservação de numeração', () => {
    it('os objetos Parcela retornados têm numero e total originais intactos', () => {
      const faturas = new Map<number, Fatura>([
        [11, fatura(11, '2026-06')],
        [12, fatura(12, '2026-07')]
      ])
      const destino = fatura(99, '2026-05')
      const parcelas = [parcela(1, 9, 12, 11), parcela(2, 10, 12, 12)]

      const resultado = selecionarParcelasParaAdiantar(parcelas, faturas, 2, destino)

      const numeros = resultado.mover.map((p) => `${p.numero}/${p.total}`)
      expect(numeros).toContain('9/12')
      expect(numeros).toContain('10/12')
    })
  })
})
