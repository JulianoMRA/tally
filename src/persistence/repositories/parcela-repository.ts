import type { Database } from '../database'
import type { Parcela } from '../../domain/entities/parcela'
import type { Fatura } from '../../domain/entities/fatura'
import type { Repository } from './types'
import { selecionarParcelasParaAdiantar } from '../../domain/services/adiantar-parcelas'
import { mesReferenciaParaData } from '../../domain/services/mes-referencia'
import {
  podeDesmarcarOcorrenciaPaga,
  podeMarcarOcorrenciaPaga
} from '../../domain/services/ocorrencia-sem-fatura'
import { mapFatura, mapParcela, type FaturaRow, type ParcelaRow } from './row-mappers'

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
    return mapParcela(row)
  }

  listarPorFatura(faturaId: number): Parcela[] {
    const rows = this.db
      .prepare('SELECT * FROM parcela WHERE fatura_id = ? ORDER BY numero ASC')
      .all(faturaId) as ParcelaRow[]
    return rows.map(mapParcela)
  }

  listarPorDespesa(despesaId: number): Parcela[] {
    const rows = this.db
      .prepare('SELECT * FROM parcela WHERE despesa_id = ? ORDER BY numero ASC')
      .all(despesaId) as ParcelaRow[]
    return rows.map(mapParcela)
  }

  /**
   * Menor número de parcela de cada despesa, em uma query. É o que separa a
   * parcelada criada do zero (começa na 1) da cadastrada em andamento — ver
   * `descreverOcorrencia`. A lista de Saídas obtém o mesmo dado por subquery;
   * aqui quem pede é o detalhe da fatura, que parte das parcelas dela.
   */
  menorNumeroPorDespesa(despesaIds: readonly number[]): Map<number, number> {
    const menores = new Map<number, number>()
    const ids = [...new Set(despesaIds)]
    if (ids.length === 0) return menores
    const placeholders = ids.map(() => '?').join(',')
    const rows = this.db
      .prepare(
        `SELECT despesa_id, MIN(numero) AS menor
           FROM parcela
          WHERE despesa_id IN (${placeholders})
          GROUP BY despesa_id`
      )
      .all(...ids) as { despesa_id: number; menor: number }[]
    for (const row of rows) menores.set(row.despesa_id, row.menor)
    return menores
  }

  adiantar(input: { despesaId: number; quantidade: number; faturaDestinoId: number }): {
    movidas: Parcela[]
    faturasAfetadas: number[]
  } {
    const despesaRow = this.db
      .prepare('SELECT tipo, forma_pagamento FROM despesa WHERE id = ?')
      .get(input.despesaId) as { tipo: string; forma_pagamento: string } | undefined
    if (!despesaRow) throw new Error(`Despesa #${input.despesaId} não encontrada`)
    if (despesaRow.tipo !== 'Parcelada' || despesaRow.forma_pagamento !== 'Credito') {
      throw new Error(
        `Adiantamento é exclusivo de despesa Parcelada de crédito (despesa #${input.despesaId} é ${despesaRow.tipo}/${despesaRow.forma_pagamento}).`
      )
    }

    const faturaDestinoRow = this.db
      .prepare('SELECT * FROM fatura WHERE id = ?')
      .get(input.faturaDestinoId) as FaturaRow | undefined
    if (!faturaDestinoRow)
      throw new Error(`Fatura destino #${input.faturaDestinoId} não encontrada`)

    const faturaDestino = mapFatura(faturaDestinoRow)

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
        faturasIndex.set(fid, mapFatura(row))
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

    // Invariante da migration 0010: parcela COM fatura tem `data_referencia`
    // igual ao mes da fatura. Mover so o `fatura_id` deixava a coluna no mes
    // antigo e desfazia, linha a linha, o backfill daquela migration — a mesma
    // parcela passava a cair num mes pela fatura e em outro pela parcela. O
    // sintoma visivel era o CSV do mes exportar linhas datadas de outro mes.
    const dataReferenciaDestino = mesReferenciaParaData(faturaDestino.mesReferencia)

    return this.db.transaction(() => {
      const update = this.db.prepare(
        `UPDATE parcela
         SET fatura_id = ?, data_referencia = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      for (const p of mover) {
        update.run(input.faturaDestinoId, dataReferenciaDestino, p.id)
      }
      const movidas = mover.map((p) => {
        const row = this.db.prepare('SELECT * FROM parcela WHERE id = ?').get(p.id) as ParcelaRow
        return mapParcela(row)
      })
      const faturasAfetadas = [...new Set([...faturasOrigemIds, input.faturaDestinoId])]
      return { movidas, faturasAfetadas }
    })()
  }

  /**
   * Cancela parcelas Pendentes em faturas Aberta (ou sem fatura).
   * Filtra por parcela.status='Pendente' (defense in depth: parcela Paga
   * em fatura Aberta nao deveria existir, mas se houver, eh preservada).
   * Parcelas em faturas Fechada/Paga sao preservadas (historico).
   */
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
      if (p.status !== 'Pendente') return false
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

  private buscarOuFalhar(parcelaId: number): Parcela {
    const row = this.db.prepare('SELECT * FROM parcela WHERE id = ?').get(parcelaId) as
      | ParcelaRow
      | undefined
    if (!row) throw new Error(`Parcela #${parcelaId} não encontrada`)
    return mapParcela(row)
  }

  /**
   * RF-DES-21 — marca uma ocorrência sem fatura como paga.
   *
   * A elegibilidade vive no domain (`podeMarcarOcorrenciaPaga`); aqui fica só a
   * escrita. Parcela COM fatura é recusada: quem a marca é o pagamento da
   * fatura (RN-06), e furar isso deixaria uma fatura Aberta com parcela Paga
   * dentro.
   */
  marcarPaga(parcelaId: number, dataPagamento: string): Parcela {
    const parcela = this.buscarOuFalhar(parcelaId)
    const permitido = podeMarcarOcorrenciaPaga(parcela)
    if (!permitido.ok) {
      throw new Error(
        permitido.motivo === 'pertence-a-fatura'
          ? `Parcela #${parcelaId} pertence a uma fatura; marque a fatura como paga.`
          : `Parcela #${parcelaId} já está paga.`
      )
    }

    this.db
      .prepare(
        `UPDATE parcela
         SET status = 'Paga', data_pagamento = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(dataPagamento, parcelaId)

    return this.buscarOuFalhar(parcelaId)
  }

  /**
   * RF-DES-21 — devolve a ocorrência a Pendente.
   *
   * `data_pagamento` volta a NULL, e não fica como resíduo: parcela Pendente
   * com data de pagamento seria um estado que nada mais no app produz, e que
   * uma leitura futura teria de aprender a ignorar.
   */
  desmarcarPaga(parcelaId: number): Parcela {
    const parcela = this.buscarOuFalhar(parcelaId)
    const permitido = podeDesmarcarOcorrenciaPaga(parcela)
    if (!permitido.ok) {
      throw new Error(
        permitido.motivo === 'pertence-a-fatura'
          ? `Parcela #${parcelaId} pertence a uma fatura; reabra a fatura para desfazer o pagamento.`
          : `Parcela #${parcelaId} já está pendente.`
      )
    }

    this.db
      .prepare(
        `UPDATE parcela
         SET status = 'Pendente', data_pagamento = NULL, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(parcelaId)

    return this.buscarOuFalhar(parcelaId)
  }
}
