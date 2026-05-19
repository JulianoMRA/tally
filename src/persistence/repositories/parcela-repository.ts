import type { Database } from '../database'
import type { Parcela, StatusParcela } from '../../domain/entities/parcela'
import type { Fatura } from '../../domain/entities/fatura'
import type { Repository } from './types'
import { selecionarParcelasParaAdiantar } from '../../domain/services/adiantar-parcelas'

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
  constructor(public readonly db: Database) {}

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

  adiantar(input: { despesaId: number; quantidade: number; faturaDestinoId: number }): {
    movidas: Parcela[]
    faturasAfetadas: number[]
  } {
    type FaturaRow = {
      id: number
      cartao_id: number
      mes_referencia: string
      data_fechamento: string
      data_vencimento: string
      status: string
      data_pagamento: string | null
      created_at: string
      updated_at: string
    }

    const faturaDestinoRow = this.db
      .prepare('SELECT * FROM fatura WHERE id = ?')
      .get(input.faturaDestinoId) as FaturaRow | undefined
    if (!faturaDestinoRow)
      throw new Error(`Fatura destino #${input.faturaDestinoId} não encontrada`)

    const faturaDestino: Fatura = {
      id: faturaDestinoRow.id,
      cartaoId: faturaDestinoRow.cartao_id,
      mesReferencia: faturaDestinoRow.mes_referencia,
      dataFechamento: faturaDestinoRow.data_fechamento,
      dataVencimento: faturaDestinoRow.data_vencimento,
      status:
        faturaDestinoRow.status === 'Paga'
          ? { kind: 'Paga', pagaEm: faturaDestinoRow.data_pagamento ?? '' }
          : faturaDestinoRow.status === 'Fechada'
            ? { kind: 'Fechada' }
            : { kind: 'Aberta' },
      createdAt: faturaDestinoRow.created_at,
      updatedAt: faturaDestinoRow.updated_at
    }

    const parcelas = this.listarPorDespesa(input.despesaId)

    const faturaIds = [
      ...new Set(parcelas.map((p) => p.faturaId).filter((id): id is number => id !== null))
    ]
    const faturasIndex = new Map<number, Fatura>()
    for (const fid of faturaIds) {
      const row = this.db.prepare('SELECT * FROM fatura WHERE id = ?').get(fid) as
        | FaturaRow
        | undefined
      if (row) {
        faturasIndex.set(fid, {
          id: row.id,
          cartaoId: row.cartao_id,
          mesReferencia: row.mes_referencia,
          dataFechamento: row.data_fechamento,
          dataVencimento: row.data_vencimento,
          status:
            row.status === 'Paga'
              ? { kind: 'Paga', pagaEm: row.data_pagamento ?? '' }
              : row.status === 'Fechada'
                ? { kind: 'Fechada' }
                : { kind: 'Aberta' },
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })
      }
    }

    const { mover } = selecionarParcelasParaAdiantar(
      parcelas,
      faturasIndex,
      input.quantidade,
      faturaDestino
    )

    if (mover.length === 0) return { movidas: [], faturasAfetadas: [] }

    const faturasOrigemIds = [
      ...new Set(mover.map((p) => p.faturaId).filter((id): id is number => id !== null))
    ]

    return this.db.transaction(() => {
      const update = this.db.prepare('UPDATE parcela SET fatura_id = ? WHERE id = ?')
      for (const p of mover) {
        update.run(input.faturaDestinoId, p.id)
      }
      const movidas = mover.map((p) => {
        const row = this.db.prepare('SELECT * FROM parcela WHERE id = ?').get(p.id) as ParcelaRow
        return mapRow(row)
      })
      const faturasAfetadas = [...new Set([...faturasOrigemIds, input.faturaDestinoId])]
      return { movidas, faturasAfetadas }
    })()
  }

  cancelarPendentes(despesaId: number): { canceladas: Parcela[] } {
    const parcelas = this.listarPorDespesa(despesaId)
    if (parcelas.length === 0) return { canceladas: [] }

    const faturaIds = [
      ...new Set(parcelas.map((p) => p.faturaId).filter((id): id is number => id !== null))
    ]

    type StatusRow = { id: number; status: string }
    const statusPorFatura = new Map<number, string>()
    for (const fid of faturaIds) {
      const row = this.db.prepare('SELECT id, status FROM fatura WHERE id = ?').get(fid) as
        | StatusRow
        | undefined
      if (row) statusPorFatura.set(fid, row.status)
    }

    const pendentes = parcelas.filter((p) => {
      if (p.faturaId === null) return true
      const status = statusPorFatura.get(p.faturaId)
      return status === 'Aberta'
    })

    if (pendentes.length === 0) return { canceladas: [] }

    return this.db.transaction(() => {
      const del = this.db.prepare('DELETE FROM parcela WHERE id = ?')
      for (const p of pendentes) {
        del.run(p.id)
      }
      return { canceladas: pendentes }
    })()
  }
}
