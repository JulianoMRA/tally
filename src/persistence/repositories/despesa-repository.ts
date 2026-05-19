import type { Database } from '../database'
import type { Despesa } from '../../domain/entities/despesa'
import type { Fatura } from '../../domain/entities/fatura'
import type { Parcela } from '../../domain/entities/parcela'
import type { Repository } from './types'
import { CartaoRepository } from './cartao-repository'
import { FaturaRepository } from './fatura-repository'
import { ParcelaRepository } from './parcela-repository'
import { gerarParcelas } from '../../domain/services/gerar-parcelas'

type DespesaRow = {
  id: number
  descricao: string
  categoria_id: number
  tipo: 'Unica' | 'Parcelada' | 'Assinatura'
  forma_pagamento: 'Credito' | 'Debito' | 'Pix' | 'Dinheiro'
  cartao_id: number | null
  valor_centavos: number
  total_parcelas: number | null
  data_compra: string
  ativa: 0 | 1
  created_at: string
  updated_at: string
}

function mapRow(row: DespesaRow): Despesa {
  return {
    id: row.id,
    descricao: row.descricao,
    categoriaId: row.categoria_id,
    tipo: row.tipo,
    formaPagamento: row.forma_pagamento,
    cartaoId: row.cartao_id,
    valorCentavos: row.valor_centavos,
    totalParcelas: row.total_parcelas,
    dataCompra: row.data_compra,
    ativa: row.ativa === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export type CriarDespesaUnicaCreditoInput = {
  descricao: string
  categoriaId: number
  cartaoId: number
  valorCentavos: number
  dataCompra: string
}

export type ResultadoCriarDespesa = {
  despesa: Despesa
  fatura: Fatura
  parcela: Parcela
}

export type CriarDespesaParceladaCreditoInput = {
  descricao: string
  categoriaId: number
  cartaoId: number
  totalParcelas: number
  valorTotalCentavos: number
  dataCompra: string
}

export type ResultadoCriarParcelada = {
  despesa: Despesa
  parcelas: Parcela[]
}

export type CriarDespesaEmAndamentoInput = {
  descricao: string
  categoriaId: number
  cartaoId: number
  totalParcelas: number
  parcelaAtual: number
  valorRestanteCentavos: number
  dataCompra: string
}

export class DespesaRepository implements Repository {
  constructor(public readonly db: Database) {}

  criarUnicaCredito(input: CriarDespesaUnicaCreditoInput): ResultadoCriarDespesa {
    const cartaoRepo = new CartaoRepository(this.db)
    const faturaRepo = new FaturaRepository(this.db)
    const parcelaRepo = new ParcelaRepository(this.db)

    const cartao = cartaoRepo.findById(input.cartaoId)
    if (!cartao) throw new Error(`Cartão #${input.cartaoId} não encontrado`)

    return this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
           VALUES (?, ?, 'Unica', 'Credito', ?, ?, 1, ?)`
        )
        .run(
          input.descricao,
          input.categoriaId,
          input.cartaoId,
          input.valorCentavos,
          input.dataCompra
        )

      const despesaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(Number(info.lastInsertRowid)) as DespesaRow | undefined
      if (!despesaRow) throw new Error('Falha ao recuperar despesa após criar')
      const despesa = mapRow(despesaRow)

      const fatura = faturaRepo.upsertParaCompra(cartao, input.dataCompra)

      const parcela = parcelaRepo.criar({
        despesaId: despesa.id,
        faturaId: fatura.id,
        numero: 1,
        total: 1,
        valorCentavos: input.valorCentavos,
        dataReferencia: input.dataCompra
      })

      return { despesa, fatura, parcela }
    })()
  }

  criarParceladaCredito(input: CriarDespesaParceladaCreditoInput): ResultadoCriarParcelada {
    const cartaoRepo = new CartaoRepository(this.db)
    const faturaRepo = new FaturaRepository(this.db)
    const parcelaRepo = new ParcelaRepository(this.db)

    const cartao = cartaoRepo.findById(input.cartaoId)
    if (!cartao) throw new Error(`Cartão #${input.cartaoId} não encontrado`)

    const planejadas = gerarParcelas({
      cartao,
      dataCompra: input.dataCompra,
      totalParcelas: input.totalParcelas,
      valorTotalCentavos: input.valorTotalCentavos
    })

    return this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
           VALUES (?, ?, 'Parcelada', 'Credito', ?, ?, ?, ?)`
        )
        .run(
          input.descricao,
          input.categoriaId,
          input.cartaoId,
          input.valorTotalCentavos,
          input.totalParcelas,
          input.dataCompra
        )

      const despesaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(Number(info.lastInsertRowid)) as DespesaRow | undefined
      if (!despesaRow) throw new Error('Falha ao recuperar despesa após criar')
      const despesa = mapRow(despesaRow)

      const parcelas: Parcela[] = []
      for (const p of planejadas) {
        const fatura = faturaRepo.upsertParaMesReferencia(cartao, p.dataReferencia)
        const parcela = parcelaRepo.criar({
          despesaId: despesa.id,
          faturaId: fatura.id,
          numero: p.numero,
          total: p.total,
          valorCentavos: p.valorCentavos,
          dataReferencia: p.dataReferencia
        })
        parcelas.push(parcela)
      }

      return { despesa, parcelas }
    })()
  }

  criarParceladaEmAndamento(input: CriarDespesaEmAndamentoInput): ResultadoCriarParcelada {
    const cartaoRepo = new CartaoRepository(this.db)
    const faturaRepo = new FaturaRepository(this.db)
    const parcelaRepo = new ParcelaRepository(this.db)

    const cartao = cartaoRepo.findById(input.cartaoId)
    if (!cartao) throw new Error(`Cartão #${input.cartaoId} não encontrado`)

    const planejadas = gerarParcelas({
      cartao,
      dataCompra: input.dataCompra,
      totalParcelas: input.totalParcelas,
      parcelaInicial: input.parcelaAtual,
      valorTotalCentavos: input.valorRestanteCentavos
    })

    return this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
           VALUES (?, ?, 'Parcelada', 'Credito', ?, ?, ?, ?)`
        )
        .run(
          input.descricao,
          input.categoriaId,
          input.cartaoId,
          input.valorRestanteCentavos,
          input.totalParcelas,
          input.dataCompra
        )

      const despesaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(Number(info.lastInsertRowid)) as DespesaRow | undefined
      if (!despesaRow) throw new Error('Falha ao recuperar despesa após criar')
      const despesa = mapRow(despesaRow)

      const parcelas: Parcela[] = []
      for (const p of planejadas) {
        const fatura = faturaRepo.upsertParaMesReferencia(cartao, p.dataReferencia)
        const parcela = parcelaRepo.criar({
          despesaId: despesa.id,
          faturaId: fatura.id,
          numero: p.numero,
          total: p.total,
          valorCentavos: p.valorCentavos,
          dataReferencia: p.dataReferencia
        })
        parcelas.push(parcela)
      }

      return { despesa, parcelas }
    })()
  }
}
