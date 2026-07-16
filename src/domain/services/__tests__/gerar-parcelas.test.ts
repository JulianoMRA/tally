import { describe, it, expect } from 'vitest'
import { gerarParcelas } from '../gerar-parcelas'
import type { Cartao } from '../../entities/cartao'

function cartao(diaFechamento: number): Cartao {
  return {
    id: 1,
    nome: 'Teste',
    diaFechamento,
    diaVencimento: diaFechamento + 7,
    cor: '#000',
    ativo: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
}

describe('gerarParcelas (RN-02)', () => {
  describe('caso base — parcelamento simples', () => {
    it('gera N parcelas numeradas 1/N, 2/N, ..., N/N', () => {
      const parcelas = gerarParcelas({
        cartao: cartao(15),
        dataCompra: '2026-05-01',
        totalParcelas: 3,
        valorTotalCentavos: 30000
      })

      expect(parcelas).toHaveLength(3)
      expect(parcelas[0].numero).toBe(1)
      expect(parcelas[0].total).toBe(3)
      expect(parcelas[1].numero).toBe(2)
      expect(parcelas[2].numero).toBe(3)
      expect(parcelas[2].total).toBe(3)
    })

    it('cada parcela tem valor = valorTotal / N (divisão exata)', () => {
      const parcelas = gerarParcelas({
        cartao: cartao(15),
        dataCompra: '2026-05-01',
        totalParcelas: 4,
        valorTotalCentavos: 40000
      })

      for (const p of parcelas) {
        expect(p.valorCentavos).toBe(10000)
      }
    })

    it('distribuição de centavos: resto vai para as últimas parcelas', () => {
      // 10001 / 3 = 3333 + 3333 + 3335
      const parcelas = gerarParcelas({
        cartao: cartao(15),
        dataCompra: '2026-05-01',
        totalParcelas: 3,
        valorTotalCentavos: 10001
      })

      expect(parcelas[0].valorCentavos).toBe(3333)
      expect(parcelas[1].valorCentavos).toBe(3333)
      expect(parcelas[2].valorCentavos).toBe(3335)
      const total = parcelas.reduce((s, p) => s + p.valorCentavos, 0)
      expect(total).toBe(10001)
    })

    it('soma de todas as parcelas sempre igual ao valorTotalCentavos', () => {
      const casos = [
        { total: 99999, n: 7 },
        { total: 1, n: 3 },
        { total: 100000, n: 12 }
      ]
      for (const { total, n } of casos) {
        const parcelas = gerarParcelas({
          cartao: cartao(10),
          dataCompra: '2026-03-15',
          totalParcelas: n,
          valorTotalCentavos: total
        })
        const soma = parcelas.reduce((s, p) => s + p.valorCentavos, 0)
        expect(soma).toBe(total)
      }
    })
  })

  describe('dataReferencia — aplicação de RN-01 por parcela', () => {
    it('primeira parcela cai na fatura de RN-01 da dataCompra', () => {
      // fechamento 15, compra dia 10 → fatura mai/2026
      const parcelas = gerarParcelas({
        cartao: cartao(15),
        dataCompra: '2026-05-10',
        totalParcelas: 3,
        valorTotalCentavos: 3000
      })

      expect(parcelas[0].dataReferencia).toBe('2026-05-01')
    })

    it('cada parcela subsequente avança 1 mês em relação à anterior', () => {
      const parcelas = gerarParcelas({
        cartao: cartao(15),
        dataCompra: '2026-05-10',
        totalParcelas: 4,
        valorTotalCentavos: 4000
      })

      expect(parcelas[0].dataReferencia).toBe('2026-05-01')
      expect(parcelas[1].dataReferencia).toBe('2026-06-01')
      expect(parcelas[2].dataReferencia).toBe('2026-07-01')
      expect(parcelas[3].dataReferencia).toBe('2026-08-01')
    })

    it('compra após fechamento: primeira parcela no mês seguinte', () => {
      // fechamento 15, compra dia 20 → fatura jun/2026
      const parcelas = gerarParcelas({
        cartao: cartao(15),
        dataCompra: '2026-05-20',
        totalParcelas: 2,
        valorTotalCentavos: 2000
      })

      expect(parcelas[0].dataReferencia).toBe('2026-06-01')
      expect(parcelas[1].dataReferencia).toBe('2026-07-01')
    })

    it('compra exatamente no dia de fechamento entra no mês seguinte (regra <)', () => {
      const parcelas = gerarParcelas({
        cartao: cartao(15),
        dataCompra: '2026-05-15',
        totalParcelas: 2,
        valorTotalCentavos: 2000
      })

      expect(parcelas[0].dataReferencia).toBe('2026-06-01')
      expect(parcelas[1].dataReferencia).toBe('2026-07-01')
    })

    it('virada de ano: novembro + 3 parcelas → nov, dez, jan', () => {
      const parcelas = gerarParcelas({
        cartao: cartao(20),
        dataCompra: '2026-11-05',
        totalParcelas: 3,
        valorTotalCentavos: 3000
      })

      expect(parcelas[0].dataReferencia).toBe('2026-11-01')
      expect(parcelas[1].dataReferencia).toBe('2026-12-01')
      expect(parcelas[2].dataReferencia).toBe('2027-01-01')
    })

    it('virada de ano com compra após fechamento: dez/out → 3x → jan, fev, mar', () => {
      // fechamento 10, compra 15/dez → fatura jan/2027
      const parcelas = gerarParcelas({
        cartao: cartao(10),
        dataCompra: '2026-12-15',
        totalParcelas: 3,
        valorTotalCentavos: 3000
      })

      expect(parcelas[0].dataReferencia).toBe('2027-01-01')
      expect(parcelas[1].dataReferencia).toBe('2027-02-01')
      expect(parcelas[2].dataReferencia).toBe('2027-03-01')
    })

    it('12 parcelas em sequência correta passando por virada de ano', () => {
      const parcelas = gerarParcelas({
        cartao: cartao(5),
        dataCompra: '2026-03-03',
        totalParcelas: 12,
        valorTotalCentavos: 120000
      })

      const refs = parcelas.map((p) => p.dataReferencia)
      expect(refs).toEqual([
        '2026-03-01',
        '2026-04-01',
        '2026-05-01',
        '2026-06-01',
        '2026-07-01',
        '2026-08-01',
        '2026-09-01',
        '2026-10-01',
        '2026-11-01',
        '2026-12-01',
        '2027-01-01',
        '2027-02-01'
      ])
    })
  })

  describe('parcelaInicial > 1 — despesa em andamento (RF-DES-03)', () => {
    it('parcelaInicial=7, totalParcelas=12 gera 6 parcelas (7..12)', () => {
      const parcelas = gerarParcelas({
        cartao: cartao(15),
        dataCompra: '2026-05-01',
        totalParcelas: 12,
        parcelaInicial: 7,
        valorTotalCentavos: 6000
      })

      expect(parcelas).toHaveLength(6)
      expect(parcelas[0].numero).toBe(7)
      expect(parcelas[0].total).toBe(12)
      expect(parcelas[5].numero).toBe(12)
    })

    it('parcelaInicial=N gera exatamente 1 parcela (última)', () => {
      const parcelas = gerarParcelas({
        cartao: cartao(15),
        dataCompra: '2026-05-01',
        totalParcelas: 12,
        parcelaInicial: 12,
        valorTotalCentavos: 1000
      })

      expect(parcelas).toHaveLength(1)
      expect(parcelas[0].numero).toBe(12)
      expect(parcelas[0].total).toBe(12)
    })

    it('parcelaInicial=1 comporta-se igual ao padrão', () => {
      const a = gerarParcelas({
        cartao: cartao(10),
        dataCompra: '2026-06-01',
        totalParcelas: 3,
        valorTotalCentavos: 3000
      })
      const b = gerarParcelas({
        cartao: cartao(10),
        dataCompra: '2026-06-01',
        totalParcelas: 3,
        parcelaInicial: 1,
        valorTotalCentavos: 3000
      })
      expect(a).toEqual(b)
    })
  })

  describe('validações de entrada', () => {
    it('lança erro se totalParcelas < 1', () => {
      expect(() =>
        gerarParcelas({
          cartao: cartao(15),
          dataCompra: '2026-05-01',
          totalParcelas: 0,
          valorTotalCentavos: 1000
        })
      ).toThrow()
    })

    it('lança erro se parcelaInicial > totalParcelas', () => {
      expect(() =>
        gerarParcelas({
          cartao: cartao(15),
          dataCompra: '2026-05-01',
          totalParcelas: 5,
          parcelaInicial: 6,
          valorTotalCentavos: 1000
        })
      ).toThrow()
    })

    it('lança erro se parcelaInicial < 1', () => {
      expect(() =>
        gerarParcelas({
          cartao: cartao(15),
          dataCompra: '2026-05-01',
          totalParcelas: 5,
          parcelaInicial: 0,
          valorTotalCentavos: 1000
        })
      ).toThrow()
    })

    it('lança erro se valorTotalCentavos <= 0', () => {
      expect(() =>
        gerarParcelas({
          cartao: cartao(15),
          dataCompra: '2026-05-01',
          totalParcelas: 3,
          valorTotalCentavos: 0
        })
      ).toThrow()
    })
  })
})
