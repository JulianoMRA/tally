import type { Database } from '../database'
import type { PagamentoParcial } from '../../domain/entities/pagamento-parcial'
import type { RegistrarPagamentoParcialInput } from '../../shared/ipc/fatura'
import type { Repository } from './types'
import {
  calcularRestanteDaFatura,
  podeExcluirPagamentoParcial,
  podeRegistrarPagamentoParcial
} from '../../domain/services/pagamento-parcial'
import {
  mapFatura,
  mapPagamentoParcial,
  type FaturaRow,
  type PagamentoParcialRow
} from './row-mappers'

export class PagamentoParcialRepository implements Repository {
  constructor(public readonly db: Database) {}

  private buscarOuFalhar(id: number): PagamentoParcial {
    const row = this.db.prepare('SELECT * FROM pagamento_parcial WHERE id = ?').get(id) as
      | PagamentoParcialRow
      | undefined
    if (!row) throw new Error(`Pagamento parcial #${id} não encontrado`)
    return mapPagamentoParcial(row)
  }

  private statusDaFatura(faturaId: number): 'Aberta' | 'Fechada' | 'Paga' {
    const row = this.db.prepare('SELECT * FROM fatura WHERE id = ?').get(faturaId) as
      | FaturaRow
      | undefined
    if (!row) throw new Error(`Fatura #${faturaId} não encontrada`)
    return mapFatura(row).status.kind
  }

  /** Por data do pagamento e, no mesmo dia, pela ordem de registro. */
  listarPorFatura(faturaId: number): PagamentoParcial[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM pagamento_parcial WHERE fatura_id = ? ORDER BY data_pagamento ASC, id ASC'
      )
      .all(faturaId) as PagamentoParcialRow[]
    return rows.map(mapPagamentoParcial)
  }

  somarPorFatura(faturaId: number): number {
    const row = this.db
      .prepare(
        'SELECT COALESCE(SUM(valor_centavos), 0) AS pago FROM pagamento_parcial WHERE fatura_id = ?'
      )
      .get(faturaId) as { pago: number }
    return Number(row.pago)
  }

  /**
   * RN-10 — registra um pagamento parcial.
   *
   * A elegibilidade vive no domain (`podeRegistrarPagamentoParcial`); aqui fica
   * a leitura do estado que ela precisa e a escrita. O que falta pagar é
   * calculado com o que está gravado AGORA — o total das parcelas da fatura
   * menos os pagamentos já registrados —, e por isso leitura e escrita ficam na
   * mesma transação.
   */
  registrar(input: RegistrarPagamentoParcialInput): PagamentoParcial {
    return this.db.transaction(() => {
      const statusFatura = this.statusDaFatura(input.faturaId)
      const totais = this.db
        .prepare(
          'SELECT COALESCE(SUM(valor_centavos), 0) AS total FROM parcela WHERE fatura_id = ?'
        )
        .get(input.faturaId) as { total: number }
      const { restanteCentavos } = calcularRestanteDaFatura(
        Number(totais.total),
        this.somarPorFatura(input.faturaId)
      )

      const permitido = podeRegistrarPagamentoParcial({
        statusFatura,
        restanteCentavos,
        valorCentavos: input.valorCentavos,
        dataPagamento: input.dataPagamento
      })
      if (!permitido.ok) throw new Error(permitido.erro)

      const info = this.db
        .prepare(
          'INSERT INTO pagamento_parcial (fatura_id, valor_centavos, data_pagamento) VALUES (?, ?, ?)'
        )
        .run(input.faturaId, input.valorCentavos, input.dataPagamento)
      return this.buscarOuFalhar(Number(info.lastInsertRowid))
    })()
  }

  /**
   * RN-10 — exclui um pagamento parcial. Fatura Paga recusa: quem quer mexer
   * nela reabre antes (RF-FAT-05), como em todo o resto do ciclo.
   */
  excluir(id: number): void {
    const pagamento = this.buscarOuFalhar(id)
    const permitido = podeExcluirPagamentoParcial(this.statusDaFatura(pagamento.faturaId))
    if (!permitido.ok) throw new Error(permitido.erro)

    this.db.prepare('DELETE FROM pagamento_parcial WHERE id = ?').run(id)
  }
}
