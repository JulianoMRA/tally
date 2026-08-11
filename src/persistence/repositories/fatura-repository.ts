import type { Database } from '../database'
import type { Cartao } from '../../domain/entities/cartao'
import type { Fatura } from '../../domain/entities/fatura'
import {
  calcularDatasDaFatura,
  calcularReferenciaFaturaDaCompra,
  formatarMesReferencia
} from '../../domain/services/calcular-fatura-da-compra'
import type { Repository } from './types'
import { mapFatura, type FaturaRow } from './row-mappers'

export type ResumoFatura = {
  fatura: Fatura
  mesReferencia: string
  totalCentavos: number
}

export type AvisoFatura = {
  tipo: 'fechamento' | 'vencimento'
  cartaoNome: string
  fatura: Fatura
}

/**
 * Predicado de fatura visível, para queries que partem da FATURA (e não do
 * cartão). Espera os aliases `f` (fatura) e `c` (cartao).
 *
 * A RF-CAR-02 mantém o histórico do cartão arquivado visível — mas fatura sem
 * nenhuma parcela não é histórico, é resíduo: a fatura nasce no upsert da
 * compra e sobrevive à exclusão da despesa. Sem esse filtro, um cartão criado
 * por engano continuava aparecendo na visão mensal e nas notificações depois
 * de arquivado.
 */
export const SQL_FATURA_VISIVEL = `(
    c.ativo = 1 OR EXISTS (SELECT 1 FROM parcela px WHERE px.fatura_id = f.id)
  )`

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

  /**
   * Faturas do cartão com o total de cada uma, em UMA query.
   *
   * A lista de faturas mostrava mês, fechamento, vencimento e status, mas não o
   * valor — a informação número um. O total só existia em
   * `detalharComParcelas`, que é uma chamada por fatura: usá-lo na lista seria
   * um N+1 sobre 13+ faturas por cartão.
   *
   * LEFT JOIN e `COALESCE`: fatura sem parcela (criada por adiantamento ou por
   * uma despesa depois excluída) precisa aparecer com total zero, não sumir.
   */
  listarResumoPorCartao(cartaoId: number): ResumoFatura[] {
    type Row = FaturaRow & { total_centavos: number }
    const rows = this.db
      .prepare(
        `SELECT f.*, COALESCE(SUM(p.valor_centavos), 0) AS total_centavos
           FROM fatura f
           LEFT JOIN parcela p ON p.fatura_id = f.id
          WHERE f.cartao_id = ?
          GROUP BY f.id
          ORDER BY f.mes_referencia`
      )
      .all(cartaoId) as Row[]

    return rows.map((row) => ({
      fatura: mapFatura(row),
      mesReferencia: row.mes_referencia,
      totalCentavos: Number(row.total_centavos)
    }))
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

  /**
   * Reverte o pagamento: as parcelas voltam a Pendente e a fatura assume o
   * status decidido pelo domain (reabrirFatura em ciclo-fatura.ts): Aberta
   * quando o fechamento ainda não passou, Fechada quando já venceu (RN-06).
   */
  reabrir(id: number, novoStatus: 'Aberta' | 'Fechada'): Fatura {
    return this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE fatura
           SET status = ?, data_pagamento = NULL, updated_at = datetime('now')
           WHERE id = ?`
        )
        .run(novoStatus, id)
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

  /**
   * Fase 7 — faturas que merecem aviso dentro da janela [hoje, ateData]:
   * Abertas prestes a fechar e Fechadas prestes a vencer. Pagas nunca avisam;
   * datas passadas não geram aviso retroativo.
   */
  listarAvisos(hoje: string, ateData: string): AvisoFatura[] {
    type Row = FaturaRow & { cartao_nome: string; tipo: 'fechamento' | 'vencimento' }
    const rows = this.db
      .prepare(
        `SELECT f.*, c.nome AS cartao_nome, 'fechamento' AS tipo
         FROM fatura f INNER JOIN cartao c ON c.id = f.cartao_id
         WHERE f.status = 'Aberta' AND f.data_fechamento BETWEEN ? AND ?
           AND ${SQL_FATURA_VISIVEL}
         UNION ALL
         SELECT f.*, c.nome AS cartao_nome, 'vencimento' AS tipo
         FROM fatura f INNER JOIN cartao c ON c.id = f.cartao_id
         WHERE f.status = 'Fechada' AND f.data_vencimento BETWEEN ? AND ?
           AND ${SQL_FATURA_VISIVEL}`
      )
      .all(hoje, ateData, hoje, ateData) as Row[]

    return rows.map((row) => ({
      tipo: row.tipo,
      cartaoNome: row.cartao_nome,
      fatura: mapFatura(row)
    }))
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
   * Realinha as datas das faturas do cartão depois que seus dias de fechamento
   * ou vencimento mudaram. Sem isso, editar o cartão deixava as faturas já
   * criadas com datas da configuração antiga.
   *
   * Fatura Paga não muda (é histórico) e Fechada preserva o `data_fechamento`
   * (o fechamento já aconteceu — só o vencimento ainda está por vir). O
   * `mes_referencia` nunca muda: mexer nele realocaria parcelas entre faturas.
   */
  realinharDatasDoCartao(cartao: Pick<Cartao, 'id' | 'diaFechamento' | 'diaVencimento'>): number {
    return this.db.transaction(() => {
      const rows = this.db
        .prepare(
          `SELECT id, mes_referencia, data_fechamento, data_vencimento, status
             FROM fatura WHERE cartao_id = ? AND status <> 'Paga'`
        )
        .all(cartao.id) as Pick<
        FaturaRow,
        'id' | 'mes_referencia' | 'data_fechamento' | 'data_vencimento' | 'status'
      >[]

      let alteradas = 0
      for (const row of rows) {
        const [ano, mes] = row.mes_referencia.split('-')
        const datas = calcularDatasDaFatura(
          { ano: Number(ano), mes: Number(mes) },
          cartao.diaFechamento,
          cartao.diaVencimento
        )
        const dataFechamento = row.status === 'Fechada' ? row.data_fechamento : datas.dataFechamento

        if (
          dataFechamento === row.data_fechamento &&
          datas.dataVencimento === row.data_vencimento
        ) {
          continue
        }

        this.db
          .prepare(
            `UPDATE fatura
             SET data_fechamento = ?, data_vencimento = ?, updated_at = datetime('now')
             WHERE id = ?`
          )
          .run(dataFechamento, datas.dataVencimento, row.id)
        alteradas++
      }
      return alteradas
    })()
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
    const { dataFechamento, dataVencimento } = calcularDatasDaFatura(
      { ano: Number(anoStr), mes: Number(mesStr) },
      cartao.diaFechamento,
      cartao.diaVencimento
    )

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
    const { dataFechamento, dataVencimento } = calcularDatasDaFatura(
      ref,
      cartao.diaFechamento,
      cartao.diaVencimento
    )

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
