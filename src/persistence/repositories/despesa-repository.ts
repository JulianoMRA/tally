import type { Database } from '../database'
import type { Despesa } from '../../domain/entities/despesa'
import type { Fatura } from '../../domain/entities/fatura'
import type { Parcela } from '../../domain/entities/parcela'
import type { Repository } from './types'
import { CartaoRepository } from './cartao-repository'
import { FaturaRepository } from './fatura-repository'
import { ParcelaRepository } from './parcela-repository'
import { gerarParcelas } from '../../domain/services/gerar-parcelas'
import { gerarOcorrenciasAssinatura } from '../../domain/services/gerar-ocorrencias-assinatura'

const HORIZONTE_ASSINATURA_MESES = 12

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

export type FormaPagamentoForaCartao = 'Debito' | 'Pix' | 'Dinheiro'

export type CriarDespesaUnicaForaCartaoInput = {
  descricao: string
  categoriaId: number
  formaPagamento: FormaPagamentoForaCartao
  valorCentavos: number
  dataCompra: string
}

export type ResultadoCriarUnicaForaCartao = {
  despesa: Despesa
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

export type CriarAssinaturaCreditoInput = {
  descricao: string
  categoriaId: number
  cartaoId: number
  valorMensalCentavos: number
  dataInicio: string
}

export type ResultadoCriarAssinatura = {
  despesa: Despesa
  parcelas: Parcela[]
}

export type ResultadoCancelarAssinatura = {
  despesa: Despesa
  canceladas: Parcela[]
}

export type ResultadoReajusteAssinatura = {
  despesa: Despesa
  atualizadas: Parcela[]
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

  criarAssinaturaCredito(input: CriarAssinaturaCreditoInput): ResultadoCriarAssinatura {
    const cartaoRepo = new CartaoRepository(this.db)
    const faturaRepo = new FaturaRepository(this.db)
    const parcelaRepo = new ParcelaRepository(this.db)

    const cartao = cartaoRepo.findById(input.cartaoId)
    if (!cartao) throw new Error(`Cartão #${input.cartaoId} não encontrado`)

    const planejadas = gerarOcorrenciasAssinatura({
      cartao,
      dataInicio: input.dataInicio,
      valorMensalCentavos: input.valorMensalCentavos,
      quantidade: HORIZONTE_ASSINATURA_MESES
    })

    return this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
           VALUES (?, ?, 'Assinatura', 'Credito', ?, ?, NULL, ?)`
        )
        .run(
          input.descricao,
          input.categoriaId,
          input.cartaoId,
          input.valorMensalCentavos,
          input.dataInicio
        )

      const despesaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(Number(info.lastInsertRowid)) as DespesaRow | undefined
      if (!despesaRow) throw new Error('Falha ao recuperar despesa após criar')
      const despesa = mapRow(despesaRow)

      const parcelas: Parcela[] = []
      for (const o of planejadas) {
        const fatura = faturaRepo.upsertParaMesReferencia(cartao, o.dataReferencia)
        const parcela = parcelaRepo.criar({
          despesaId: despesa.id,
          faturaId: fatura.id,
          numero: o.numero,
          total: o.total,
          valorCentavos: o.valorCentavos,
          dataReferencia: o.dataReferencia
        })
        parcelas.push(parcela)
      }

      return { despesa, parcelas }
    })()
  }

  cancelarAssinatura(despesaId: number): ResultadoCancelarAssinatura {
    const despesaRow = this.db.prepare('SELECT * FROM despesa WHERE id = ?').get(despesaId) as
      | DespesaRow
      | undefined
    if (!despesaRow) throw new Error(`Despesa #${despesaId} não encontrada`)
    if (despesaRow.tipo !== 'Assinatura') {
      throw new Error(`Despesa #${despesaId} não é uma assinatura (tipo=${despesaRow.tipo})`)
    }

    return this.db.transaction(() => {
      type ParcelaRow = {
        id: number
        despesa_id: number
        fatura_id: number | null
        numero: number
        total: number | null
        valor_centavos: number
        data_referencia: string
        status: 'Pendente' | 'Paga'
        data_pagamento: string | null
        created_at: string
        updated_at: string
      }

      const rowsParaCancelar = this.db
        .prepare(
          `SELECT p.* FROM parcela p
           INNER JOIN fatura f ON f.id = p.fatura_id
           WHERE p.despesa_id = ? AND f.status = 'Aberta'`
        )
        .all(despesaId) as ParcelaRow[]

      const del = this.db.prepare('DELETE FROM parcela WHERE id = ?')
      const canceladas: Parcela[] = []
      for (const row of rowsParaCancelar) {
        del.run(row.id)
        canceladas.push({
          id: row.id,
          despesaId: row.despesa_id,
          faturaId: row.fatura_id,
          numero: row.numero,
          total: row.total,
          valorCentavos: row.valor_centavos,
          dataReferencia: row.data_referencia,
          status: row.status,
          dataPagamento: row.data_pagamento,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })
      }

      this.db
        .prepare(`UPDATE despesa SET ativa = 0, updated_at = datetime('now') WHERE id = ?`)
        .run(despesaId)

      const atualizada = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(despesaId) as DespesaRow
      return { despesa: mapRow(atualizada), canceladas }
    })()
  }

  reajustarValorMensalAssinatura(
    despesaId: number,
    novoValorCentavos: number
  ): ResultadoReajusteAssinatura {
    if (!Number.isInteger(novoValorCentavos) || novoValorCentavos <= 0) {
      throw new Error(`novoValorCentavos deve ser inteiro > 0, recebido: ${novoValorCentavos}`)
    }

    const despesaRow = this.db.prepare('SELECT * FROM despesa WHERE id = ?').get(despesaId) as
      | DespesaRow
      | undefined
    if (!despesaRow) throw new Error(`Despesa #${despesaId} não encontrada`)
    if (despesaRow.tipo !== 'Assinatura') {
      throw new Error(`Despesa #${despesaId} não é uma assinatura (tipo=${despesaRow.tipo})`)
    }

    const parcelaRepo = new ParcelaRepository(this.db)

    return this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE parcela
           SET valor_centavos = ?, updated_at = datetime('now')
           WHERE despesa_id = ?
             AND status = 'Pendente'
             AND fatura_id IN (SELECT id FROM fatura WHERE status = 'Aberta')`
        )
        .run(novoValorCentavos, despesaId)

      this.db
        .prepare(`UPDATE despesa SET valor_centavos = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(novoValorCentavos, despesaId)

      const atualizadaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(despesaId) as DespesaRow
      const todasParcelas = parcelaRepo.listarPorDespesa(despesaId)
      const atualizadas = todasParcelas.filter((p) => p.valorCentavos === novoValorCentavos)

      return { despesa: mapRow(atualizadaRow), atualizadas }
    })()
  }

  criarUnicaForaCartao(input: CriarDespesaUnicaForaCartaoInput): ResultadoCriarUnicaForaCartao {
    const parcelaRepo = new ParcelaRepository(this.db)

    return this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
           VALUES (?, ?, 'Unica', ?, NULL, ?, 1, ?)`
        )
        .run(
          input.descricao,
          input.categoriaId,
          input.formaPagamento,
          input.valorCentavos,
          input.dataCompra
        )

      const despesaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(Number(info.lastInsertRowid)) as DespesaRow | undefined
      if (!despesaRow) throw new Error('Falha ao recuperar despesa após criar')
      const despesa = mapRow(despesaRow)

      const parcela = parcelaRepo.criar({
        despesaId: despesa.id,
        faturaId: null,
        numero: 1,
        total: 1,
        valorCentavos: input.valorCentavos,
        dataReferencia: input.dataCompra
      })

      return { despesa, parcela }
    })()
  }

  listarGastosForaCartao(filtro?: { mesReferencia?: string }): Despesa[] {
    let sql =
      "SELECT * FROM despesa WHERE tipo = 'Unica' AND forma_pagamento != 'Credito' AND ativa = 1"
    const params: unknown[] = []
    if (filtro?.mesReferencia) {
      sql += ' AND substr(data_compra, 1, 7) = ?'
      params.push(filtro.mesReferencia)
    }
    sql += ' ORDER BY data_compra DESC, id DESC'
    const rows = this.db.prepare(sql).all(...params) as DespesaRow[]
    return rows.map(mapRow)
  }

  listarAssinaturas(filtro?: { ativa?: boolean }): Despesa[] {
    let sql = "SELECT * FROM despesa WHERE tipo = 'Assinatura'"
    const params: unknown[] = []
    if (filtro?.ativa !== undefined) {
      sql += ' AND ativa = ?'
      params.push(filtro.ativa ? 1 : 0)
    }
    sql += ' ORDER BY ativa DESC, descricao ASC'
    const rows = this.db.prepare(sql).all(...params) as DespesaRow[]
    return rows.map(mapRow)
  }
}
