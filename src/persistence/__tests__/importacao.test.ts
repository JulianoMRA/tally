import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { importarLinhas } from '../importacao'
import { FaturaRepository } from '../repositories/fatura-repository'
import type { LinhaImportacao } from '../../shared/ipc/importacao'

function contar(db: Database, tabela: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).get() as { n: number }).n
}

describe('importarLinhas (lote CSV em transação única)', () => {
  let db: Database

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    db.exec(
      `INSERT INTO cartao (id, nome, dia_fechamento, dia_vencimento, cor) VALUES (1, 'Inter', 5, 12, '#f60')`
    )
    db.exec(`INSERT INTO categoria (id, nome, tipo, cor) VALUES (1, 'Mercado', 'Despesa', '#fa0')`)
  })

  it('importa os seis tipos de linha e conta por tipo', () => {
    const linhas: LinhaImportacao[] = [
      {
        tipo: 'gastoForaCartao',
        descricao: 'Pix almoço',
        categoriaNome: 'Mercado',
        formaPagamento: 'Pix',
        valorCentavos: 2500,
        data: '2026-07-10'
      },
      {
        tipo: 'unicaCredito',
        descricao: 'Supermercado',
        categoriaNome: 'mercado', // case-insensitive
        cartaoNome: 'INTER',
        valorCentavos: 8000,
        data: '2026-07-02'
      },
      {
        tipo: 'parceladaEmAndamento',
        descricao: 'Notebook 7/12',
        categoriaNome: 'Mercado',
        cartaoNome: 'Inter',
        totalParcelas: 12,
        parcelaAtual: 7,
        valorRestanteCentavos: 60000,
        dataCompra: '2026-07-02'
      },
      {
        tipo: 'assinatura',
        descricao: 'Streaming',
        categoriaNome: 'Mercado',
        cartaoNome: 'Inter',
        valorMensalCentavos: 3990,
        dataInicio: '2026-07-02'
      },
      {
        tipo: 'rendaRecorrente',
        nome: 'Bolsa',
        valorCentavos: 120000,
        diaEsperado: 5,
        dataInicio: '2026-07-01'
      },
      {
        tipo: 'recebimentoAvulso',
        nome: 'Freela',
        valorCentavos: 50000,
        dataEsperada: '2026-07-15',
        dataRecebida: null
      }
    ]

    const resultado = importarLinhas(db, linhas)

    expect(resultado.inseridos).toBe(6)
    expect(resultado.porTipo).toEqual({
      gastoForaCartao: 1,
      unicaCredito: 1,
      parceladaEmAndamento: 1,
      assinatura: 1,
      rendaRecorrente: 1,
      recebimentoAvulso: 1
    })
    expect(contar(db, 'despesa')).toBe(4)
    // parcelada em andamento 7..12 = 6 parcelas; assinatura = 12; única crédito = 1; pix = 1
    expect(contar(db, 'parcela')).toBe(20)
    expect(contar(db, 'renda')).toBe(2) // recorrente + avulsa implícita
    expect(contar(db, 'recebimento')).toBe(13) // 12 esperados + 1 avulso
  })

  it('categoria inexistente aborta com o numero da linha e reverte tudo', () => {
    const linhas: LinhaImportacao[] = [
      {
        tipo: 'gastoForaCartao',
        descricao: 'Válido',
        categoriaNome: 'Mercado',
        formaPagamento: 'Pix',
        valorCentavos: 100,
        data: '2026-07-10'
      },
      {
        tipo: 'gastoForaCartao',
        descricao: 'Inválido',
        categoriaNome: 'NaoExiste',
        formaPagamento: 'Pix',
        valorCentavos: 100,
        data: '2026-07-10'
      }
    ]

    expect(() => importarLinhas(db, linhas)).toThrow(/Linha 3: categoria 'NaoExiste'/)
    expect(contar(db, 'despesa')).toBe(0)
  })

  it('cartao inexistente aborta com o numero da linha', () => {
    const linhas: LinhaImportacao[] = [
      {
        tipo: 'unicaCredito',
        descricao: 'X',
        categoriaNome: 'Mercado',
        cartaoNome: 'Nubank',
        valorCentavos: 100,
        data: '2026-07-02'
      }
    ]
    expect(() => importarLinhas(db, linhas)).toThrow(/Linha 2: cartão 'Nubank'/)
  })

  it('linha que cai em fatura Paga reverte o lote inteiro (RF-FAT-04)', () => {
    // Materializa e paga a fatura de jul/2026 do Inter
    const resultado = importarLinhas(db, [
      {
        tipo: 'unicaCredito',
        descricao: 'Seed',
        categoriaNome: 'Mercado',
        cartaoNome: 'Inter',
        valorCentavos: 1000,
        data: '2026-07-02'
      }
    ])
    expect(resultado.inseridos).toBe(1)
    const faturaRepo = new FaturaRepository(db)
    const fatura = faturaRepo.findByCartaoEMesReferencia(1, '2026-07')
    if (!fatura) throw new Error('setup: fatura não criada')
    faturaRepo.fechar(fatura.id)
    faturaRepo.pagar(fatura.id, '2026-07-12')

    const despesasAntes = contar(db, 'despesa')

    expect(() =>
      importarLinhas(db, [
        {
          tipo: 'gastoForaCartao',
          descricao: 'Válido',
          categoriaNome: 'Mercado',
          formaPagamento: 'Pix',
          valorCentavos: 100,
          data: '2026-07-10'
        },
        {
          tipo: 'unicaCredito',
          descricao: 'Na fatura paga',
          categoriaNome: 'Mercado',
          cartaoNome: 'Inter',
          valorCentavos: 100,
          data: '2026-07-02'
        }
      ])
    ).toThrow(/Linha 3: .*paga/i)

    expect(contar(db, 'despesa')).toBe(despesasAntes)
  })

  it('categoria arquivada nao resolve (apenas ativos)', () => {
    db.exec(`UPDATE categoria SET ativo = 0 WHERE id = 1`)
    expect(() =>
      importarLinhas(db, [
        {
          tipo: 'gastoForaCartao',
          descricao: 'X',
          categoriaNome: 'Mercado',
          formaPagamento: 'Pix',
          valorCentavos: 100,
          data: '2026-07-10'
        }
      ])
    ).toThrow(/Linha 2: categoria 'Mercado'/)
  })
})
