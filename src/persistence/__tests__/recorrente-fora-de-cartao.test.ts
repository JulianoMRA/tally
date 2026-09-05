import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { DespesaRepository } from '../repositories/despesa-repository'
import { ParcelaRepository } from '../repositories/parcela-repository'

/** Hoje fixo: ocorrências de 2026-09-10 para trás são passado; 10-10 em diante, futuro. */
const HOJE = '2026-09-15T12:00:00Z'

function inserirCategoria(db: Database): number {
  const info = db
    .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Moradia', 'Despesa', '#aaa')")
    .run()
  return Number(info.lastInsertRowid)
}

describe('Despesa recorrente fora de cartão (RF-DES-16 a RF-DES-20)', () => {
  let db: Database
  let repo: DespesaRepository
  let parcelaRepo: ParcelaRepository
  let catId: number

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(HOJE))
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new DespesaRepository(db)
    parcelaRepo = new ParcelaRepository(db)
    catId = inserirCategoria(db)
  })

  afterEach(() => {
    vi.useRealTimers()
    db.close()
  })

  function criarAluguel(over: Partial<Parameters<typeof repo.criarAssinaturaForaCartao>[0]> = {}) {
    return repo.criarAssinaturaForaCartao({
      descricao: 'Aluguel',
      categoriaId: catId,
      formaPagamento: 'Pix',
      valorMensalCentavos: 150000,
      mesInicial: '2026-06',
      diaCobranca: 10,
      recorreAte: null,
      ...over
    })
  }

  function datasDa(despesaId: number): string[] {
    return parcelaRepo
      .listarPorDespesa(despesaId)
      .map((p) => p.dataReferencia)
      .sort()
  }

  describe('criação (RF-DES-16, RF-DES-17)', () => {
    it('gera o horizonte de 12 ocorrências, todas SEM fatura, no dia pedido', () => {
      const { despesa, parcelas } = criarAluguel()

      expect(parcelas).toHaveLength(12)
      expect(parcelas.every((p) => p.faturaId === null)).toBe(true)
      expect(parcelas.every((p) => p.dataReferencia.endsWith('-10'))).toBe(true)
      expect(despesa.tipo).toBe('Assinatura')
      expect(despesa.formaPagamento).toBe('Pix')
      expect(despesa.cartaoId).toBeNull()
    })

    it('guarda o dia pedido e usa a primeira ocorrência como data de início', () => {
      const { despesa } = criarAluguel()

      expect(despesa.diaCobranca).toBe(10)
      expect(despesa.dataCompra).toBe('2026-06-10')
      expect(despesa.recorreAte).toBeNull()
    })

    it('o clamp de um mês curto não contamina os seguintes', () => {
      // O motivo de `dia_cobranca` existir como coluna: derivar o dia da data da
      // primeira ocorrência faria "todo dia 31" virar 28 para sempre.
      const { despesa } = criarAluguel({ mesInicial: '2026-01', diaCobranca: 31 })

      expect(despesa.diaCobranca).toBe(31)
      expect(datasDa(despesa.id).slice(0, 4)).toEqual([
        '2026-01-31',
        '2026-02-28',
        '2026-03-31',
        '2026-04-30'
      ])
    })

    it('a data limite corta o horizonte na criação (RF-DES-18)', () => {
      const { despesa, parcelas } = criarAluguel({ recorreAte: '2026-08-31' })

      expect(datasDa(despesa.id)).toEqual(['2026-06-10', '2026-07-10', '2026-08-10'])
      expect(parcelas).toHaveLength(3)
    })

    it('recusa limite anterior à primeira cobrança em vez de criar despesa estéril', () => {
      expect(() => criarAluguel({ recorreAte: '2026-05-01' })).toThrow(/limite|anterior/i)
      expect(db.prepare('SELECT COUNT(*) AS n FROM despesa').get()).toEqual({ n: 0 })
    })
  })

  describe('leitura do mês (RN-08)', () => {
    it('cada mês enxerga a SUA ocorrência, com o valor de um mês', () => {
      criarAluguel()

      const junho = repo.listarGastosForaCartao({ mesReferencia: '2026-06' })
      const setembro = repo.listarGastosForaCartao({ mesReferencia: '2026-09' })

      expect(junho).toHaveLength(1)
      expect(junho[0]).toMatchObject({
        descricao: 'Aluguel',
        valorCentavos: 150000,
        data: '2026-06-10',
        numero: 1
      })
      expect(setembro).toHaveLength(1)
      expect(setembro[0]).toMatchObject({ data: '2026-09-10', numero: 4 })
    })

    it('o gasto único fora de cartão continua aparecendo como antes', () => {
      repo.criarUnicaForaCartao({
        descricao: 'Feira',
        categoriaId: catId,
        formaPagamento: 'Pix',
        valorCentavos: 8000,
        dataCompra: '2026-06-03'
      })

      const junho = repo.listarGastosForaCartao({ mesReferencia: '2026-06' })

      expect(junho).toHaveLength(1)
      expect(junho[0]).toMatchObject({
        descricao: 'Feira',
        valorCentavos: 8000,
        data: '2026-06-03'
      })
    })

    it('ocorrência de recorrente CANCELADA continua no mês que já passou', () => {
      // Filtrar por `ativa = 1` apagaria o aluguel de junho do mês de junho
      // depois de um cancelamento em setembro — reescrita de histórico.
      const { despesa } = criarAluguel()
      repo.cancelarAssinatura(despesa.id)

      expect(repo.listarGastosForaCartao({ mesReferencia: '2026-06' })).toHaveLength(1)
    })
  })

  describe('cancelar (RF-DES-20)', () => {
    it('cancela as ocorrências futuras — sem cartão isso era um no-op silencioso', () => {
      const { despesa } = criarAluguel()

      const { canceladas } = repo.cancelarAssinatura(despesa.id)

      expect(canceladas.length).toBeGreaterThan(0)
      expect(canceladas.every((p) => p.dataReferencia > '2026-09-15')).toBe(true)
    })

    it('preserva as ocorrências que já aconteceram', () => {
      const { despesa } = criarAluguel()

      repo.cancelarAssinatura(despesa.id)

      expect(datasDa(despesa.id)).toEqual(['2026-06-10', '2026-07-10', '2026-08-10', '2026-09-10'])
    })

    it('marca a despesa como inativa', () => {
      const { despesa } = criarAluguel()

      const resultado = repo.cancelarAssinatura(despesa.id)

      expect(resultado.despesa.ativa).toBe(false)
    })
  })

  describe('reajustar valor (RF-DES-20)', () => {
    it('atualiza as ocorrências futuras — sem cartão isso era um no-op silencioso', () => {
      const { despesa } = criarAluguel()

      repo.reajustarValorMensalAssinatura(despesa.id, 165000)

      const futuras = parcelaRepo
        .listarPorDespesa(despesa.id)
        .filter((p) => p.dataReferencia > '2026-09-15')
      expect(futuras.length).toBeGreaterThan(0)
      expect(futuras.every((p) => p.valorCentavos === 165000)).toBe(true)
    })

    it('não reescreve o valor das ocorrências que já saíram da conta', () => {
      const { despesa } = criarAluguel()

      repo.reajustarValorMensalAssinatura(despesa.id, 165000)

      const passadas = parcelaRepo
        .listarPorDespesa(despesa.id)
        .filter((p) => p.dataReferencia < '2026-09-15')
      expect(passadas.every((p) => p.valorCentavos === 150000)).toBe(true)
    })
  })

  describe('extensão de horizonte (RN-04)', () => {
    it('estende a recorrente sem cartão — antes o laço a pulava por falta de cartão', () => {
      const { despesa } = criarAluguel()
      const antes = datasDa(despesa.id).length

      const { parcelasCriadas } = repo.estenderHorizonteAssinaturas('2027-08')

      expect(parcelasCriadas).toBeGreaterThan(0)
      expect(datasDa(despesa.id).length).toBeGreaterThan(antes)
      expect(datasDa(despesa.id)).toContain('2027-08-10')
    })

    it('não cria fatura ao estender uma recorrente sem cartão', () => {
      criarAluguel()

      const { faturasCriadas } = repo.estenderHorizonteAssinaturas('2027-08')

      expect(faturasCriadas).toBe(0)
      expect(db.prepare('SELECT COUNT(*) AS n FROM fatura').get()).toEqual({ n: 0 })
    })

    it('para no limite de recorrência em vez de alcançar o alvo', () => {
      const { despesa } = criarAluguel({ recorreAte: '2026-12-31' })

      repo.estenderHorizonteAssinaturas('2027-08')

      expect(datasDa(despesa.id).at(-1)).toBe('2026-12-10')
    })

    it('é idempotente: estender duas vezes para o mesmo alvo não duplica', () => {
      const { despesa } = criarAluguel()
      repo.estenderHorizonteAssinaturas('2027-03')
      const depoisDaPrimeira = datasDa(despesa.id)

      repo.estenderHorizonteAssinaturas('2027-03')

      expect(datasDa(despesa.id)).toEqual(depoisDaPrimeira)
    })
  })

  describe('alterar o limite depois (RF-DES-19)', () => {
    it('encurtar apaga as ocorrências futuras além do novo limite', () => {
      const { despesa } = criarAluguel()

      repo.atualizarLimiteRecorrencia(despesa.id, '2026-11-30')

      expect(datasDa(despesa.id).at(-1)).toBe('2026-11-10')
    })

    it('encurtar não toca no que já aconteceu', () => {
      const { despesa } = criarAluguel()

      repo.atualizarLimiteRecorrencia(despesa.id, '2026-07-31')

      expect(datasDa(despesa.id)).toContain('2026-06-10')
      expect(datasDa(despesa.id)).toContain('2026-09-10')
    })

    it('esticar volta a gerar até o horizonte', () => {
      const { despesa } = criarAluguel({ recorreAte: '2026-10-31' })
      expect(datasDa(despesa.id).at(-1)).toBe('2026-10-10')

      repo.atualizarLimiteRecorrencia(despesa.id, '2027-04-30')

      expect(datasDa(despesa.id).at(-1)).toBe('2027-04-10')
    })

    it('voltar para "sempre" regenera mesmo depois de o limite ter apagado tudo', () => {
      // O caso que reproduz o defeito do PR #129: sem semear do zero, a
      // recorrente ficaria ativa e estéril para sempre.
      const { despesa } = criarAluguel({ mesInicial: '2026-10', diaCobranca: 10 })
      repo.atualizarLimiteRecorrencia(despesa.id, '2026-09-01')
      expect(datasDa(despesa.id)).toEqual([])

      repo.atualizarLimiteRecorrencia(despesa.id, null)

      expect(datasDa(despesa.id).length).toBeGreaterThan(0)
      expect(datasDa(despesa.id)[0]).toBe('2026-10-10')
    })

    it('recusa alterar o limite de uma assinatura de cartão', () => {
      const cartaoId = Number(
        db
          .prepare(
            'INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)'
          )
          .run('Inter', 5, 12, '#000').lastInsertRowid
      )
      const { despesa } = repo.criarAssinaturaCredito({
        descricao: 'Streaming',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 3990,
        dataInicio: '2026-06-03'
      })

      expect(() => repo.atualizarLimiteRecorrencia(despesa.id, '2027-01-01')).toThrow(
        /recorrente sem cartao/i
      )
    })

    it('recusa limite fora do formato de data', () => {
      const { despesa } = criarAluguel()

      expect(() => repo.atualizarLimiteRecorrencia(despesa.id, '30/11/2026')).toThrow(/recorreAte/i)
    })
  })
})
