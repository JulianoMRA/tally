import type Database from 'better-sqlite3'
import type { Parcela, StatusParcela } from '../../domain/entities/parcela'
import type { Repository } from './types'

type ParcelaRow = {
  id: number
  despesa_id: number
  fatura_id: number | null
  numero: number
  total: number | null
  valor_centavos: number
  data_referencia: string
  status: StatusParcela
  data_pagamento: string | null
  created_at: string
  updated_at: string
}

function mapRow(row: ParcelaRow): Parcela {
  return {
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
  }
}

export type CriarParcelaInput = {
  despesaId: number
  faturaId: number | null
  numero: number
  total: number | null
  valorCentavos: number
  dataReferencia: string
}

export class ParcelaRepository implements Repository {
  constructor(public readonly db: Database.Database) {}

  criar(input: CriarParcelaInput): Parcela {
    const info = this.db
      .prepare(
        `INSERT INTO parcela (despesa_id, fatura_id, numero, total, valor_centavos, data_referencia)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.despesaId,
        input.faturaId,
        input.numero,
        input.total,
        input.valorCentavos,
        input.dataReferencia
      )
    const row = this.db
      .prepare('SELECT * FROM parcela WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as ParcelaRow | undefined
    if (!row) throw new Error('Falha ao recuperar parcela após criar')
    return mapRow(row)
  }

  listarPorFatura(faturaId: number): Parcela[] {
    const rows = this.db
      .prepare('SELECT * FROM parcela WHERE fatura_id = ? ORDER BY numero ASC')
      .all(faturaId) as ParcelaRow[]
    return rows.map(mapRow)
  }

  listarPorDespesa(despesaId: number): Parcela[] {
    const rows = this.db
      .prepare('SELECT * FROM parcela WHERE despesa_id = ? ORDER BY numero ASC')
      .all(despesaId) as ParcelaRow[]
    return rows.map(mapRow)
  }
}
