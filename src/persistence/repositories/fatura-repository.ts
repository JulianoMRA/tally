import type { Database } from '../database'
import type { Cartao } from '../../domain/entities/cartao'
import type { Fatura } from '../../domain/entities/fatura'
import {
  calcularReferenciaFaturaDaCompra,
  formatarMesReferencia
} from '../../domain/services/calcular-fatura-da-compra'
import { clampDiaNoMes } from '../../domain/services/mes-referencia'
import type { Repository } from './types'
import { mapFatura, type FaturaRow } from './row-mappers'

export class FaturaRepository implements Repository {
  constructor(public readonly db: Database) {}

  findById(id: number): Fatura | null {
    const row = this.db.prepare('SELECT * FROM fatura WHERE id = ?').get(id) as
      | FaturaRow
      | undefined
    return row ? mapFatura(row) : null
  }

  findByCartaoEMesReferencia(cartaoId: number, mesReferencia: string): Fatura | null {
    const row = this.db
      .prepare('SELECT * FROM fatura WHERE cartao_id = ? AND mes_referencia = ?')
      .get(cartaoId, mesReferencia) as FaturaRow | undefined
    return row ? mapFatura(row) : null
  }

  list(cartaoId?: number): Fatura[] {
    const rows = (
      cartaoId === undefined
        ? this.db.prepare('SELECT * FROM fatura ORDER BY mes_referencia, cartao_id').all()
        : this.db
            .prepare('SELECT * FROM fatura WHERE cartao_id = ? ORDER BY mes_referencia')
            .all(cartaoId)
    ) as FaturaRow[]
    return rows.map(mapFatura)
  }

  /**
   * Move faturas Aberta vencidas para Fechada. Idempotente — chamada no boot
   * e em pontos explicitos (ex.: antes de detalhar visao mensal). NAO deve
   * ser chamada dentro de metodos de leitura: list() deixou de ter esse
   * efeito colateral para que SELECTs nunca disparem escritas.
   */
  fecharVencidas(hoje: string): number {
    const result = this.db
      .prepare(
        `UPDATE fatura
         SET status = 'Fechada', updated_at = datetime('now')
         WHERE status = 'Aberta' AND data_fechamento <= ?`
      )
      .run(hoje)
    return result.changes
  }

  fechar(id: number): Fatura {
    this.db
      .prepare(`UPDATE fatura SET status = 'Fechada', updated_at = datetime('now') WHERE id = ?`)
      .run(id)
    const fatura = this.findById(id)
    if (!fatura) throw new Error(`fechar: fatura #${id} não encontrada`)
    return fatura
  }

  /**
   * RN-06 — pagar a fatura também marca suas parcelas Pendente como Paga,
   * com a mesma data de pagamento. É essa sincronização que arma as regras
   * RF-DES-09/10 (despesa com parcela paga não pode ser excluída/editada).
   */
  pagar(id: number, dataPagamento: string): Fatura {
    return this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE fatura
           SET status = 'Paga', data_pagamento = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .run(dataPagamento, id)
      this.db
        .prepare(
          `UPDATE parcela
           SET status = 'Paga', data_pagamento = ?, updated_at = datetime('now')
           WHERE fatura_id = ? AND status = 'Pendente'`
        )
        .run(dataPagamento, id)
      const fatura = this.findById(id)
      if (!fatura) throw new Error(`pagar: fatura #${id} não encontrada`)
      return fatura
    })()
  }

  /** Reverte o pagamento: fatura volta a Aberta e as parcelas a Pendente. */
  reabrir(id: number): Fatura {
    return this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE fatura
           SET status = 'Aberta', data_pagamento = NULL, updated_at = datetime('now')
           WHERE id = ?`
        )
        .run(id)
      this.db
        .prepare(
          `UPDATE parcela
           SET status = 'Pendente', data_pagamento = NULL, updated_at = datetime('now')
           WHERE fatura_id = ? AND status = 'Paga'`
        )
        .run(id)
      const fatura = this.findById(id)
      if (!fatura) throw new Error(`reabrir: fatura #${id} não encontrada`)
      return fatura
    })()
  }

  /** Mapa id da fatura -> status, em uma única query. */
  statusPorIds(ids: readonly number[]): Map<number, 'Aberta' | 'Fechada' | 'Paga'> {
    const mapa = new Map<number, 'Aberta' | 'Fechada' | 'Paga'>()
    if (ids.length === 0) return mapa
    const placeholders = ids.map(() => '?').join(',')
    const rows = this.db
      .prepare(`SELECT id, status FROM fatura WHERE id IN (${placeholders})`)
      .all(...ids) as { id: number; status: 'Aberta' | 'Fechada' | 'Paga' }[]
    for (const row of rows) mapa.set(row.id, row.status)
    return mapa
  }

  /**
   * Garante que existe uma fatura para o cartão em um `mesReferencia` já calculado
   * (formato "YYYY-MM"). Usado ao criar parcelas cujas datas de referência foram
   * determinadas por gerarParcelas — não re-aplica RN-01.
   */
  upsertParaMesReferencia(
    cartao: Pick<Cartao, 'id' | 'diaFechamento' | 'diaVencimento'>,
    mesReferencia: string
  ): Fatura {
    const [anoStr, mesStr] = mesReferencia.split('-')
    const ano = Number(anoStr)
    const mes = Number(mesStr)
    const dataFechamento = clampDiaNoMes(ano, mes, cartao.diaFechamento)
    const dataVencimento = clampDiaNoMes(ano, mes, cartao.diaVencimento)

    this.db
      .prepare(
        `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
         VALUES (?, ?, ?, ?, 'Aberta')
         ON CONFLICT(cartao_id, mes_referencia) DO NOTHING`
      )
      .run(cartao.id, mesReferencia, dataFechamento, dataVencimento)

    const fatura = this.findByCartaoEMesReferencia(cartao.id, mesReferencia)
    if (!fatura) {
      throw new Error(
        `upsertParaMesReferencia: falha ao recuperar fatura ${mesReferencia} do cartão ${cartao.id}`
      )
    }
    return fatura
  }

  /**
   * Garante que existe uma fatura para o cartão na referência calculada via RN-01
   * a partir da `dataCompra`. Idempotente: chamadas repetidas devolvem a mesma fatura.
   */
  upsertParaCompra(
    cartao: Pick<Cartao, 'id' | 'diaFechamento' | 'diaVencimento'>,
    dataCompra: string
  ): Fatura {
    const ref = calcularReferenciaFaturaDaCompra(dataCompra, cartao.diaFechamento)
    const mesReferencia = formatarMesReferencia(ref)
    const dataFechamento = clampDiaNoMes(ref.ano, ref.mes, cartao.diaFechamento)
    const dataVencimento = clampDiaNoMes(ref.ano, ref.mes, cartao.diaVencimento)

    this.db
      .prepare(
        `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
         VALUES (?, ?, ?, ?, 'Aberta')
         ON CONFLICT(cartao_id, mes_referencia) DO NOTHING`
      )
      .run(cartao.id, mesReferencia, dataFechamento, dataVencimento)

    const fatura = this.findByCartaoEMesReferencia(cartao.id, mesReferencia)
    if (!fatura) {
      throw new Error(
        `upsertParaCompra: falha ao recuperar fatura ${mesReferencia} do cartão ${cartao.id}`
      )
    }
    return fatura
  }
}
