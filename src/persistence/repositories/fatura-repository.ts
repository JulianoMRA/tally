import type { Database } from '../database'
import type { Cartao } from '../../domain/entities/cartao'
import type { Fatura, StatusFatura } from '../../domain/entities/fatura'
import {
  calcularReferenciaFaturaDaCompra,
  formatarMesReferencia
} from '../../domain/services/calcular-fatura-da-compra'
import type { Repository } from './types'

type FaturaRow = {
  id: number
  cartao_id: number
  mes_referencia: string
  data_fechamento: string
  data_vencimento: string
  status: 'Aberta' | 'Fechada' | 'Paga'
  data_pagamento: string | null
  created_at: string
  updated_at: string
}

function diasNoMes(ano: number, mes: number): number {
  if (mes === 2) {
    const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
    return bissexto ? 29 : 28
  }
  if ([4, 6, 9, 11].includes(mes)) return 30
  return 31
}

function dataDoMes(ano: number, mes: number, dia: number): string {
  const diaClamp = Math.min(dia, diasNoMes(ano, mes))
  return `${ano.toString().padStart(4, '0')}-${mes.toString().padStart(2, '0')}-${diaClamp.toString().padStart(2, '0')}`
}

function mapRow(row: FaturaRow): Fatura {
  let status: StatusFatura
  switch (row.status) {
    case 'Aberta':
      status = { kind: 'Aberta' }
      break
    case 'Fechada':
      status = { kind: 'Fechada' }
      break
    case 'Paga':
      if (!row.data_pagamento) {
        throw new Error(`Fatura #${row.id} marcada como Paga sem data_pagamento`)
      }
      status = { kind: 'Paga', pagaEm: row.data_pagamento }
      break
  }
  return {
    id: row.id,
    cartaoId: row.cartao_id,
    mesReferencia: row.mes_referencia,
    dataFechamento: row.data_fechamento,
    dataVencimento: row.data_vencimento,
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class FaturaRepository implements Repository {
  constructor(public readonly db: Database) {}

  findById(id: number): Fatura | null {
    const row = this.db.prepare('SELECT * FROM fatura WHERE id = ?').get(id) as
      | FaturaRow
      | undefined
    return row ? mapRow(row) : null
  }

  findByCartaoEMesReferencia(cartaoId: number, mesReferencia: string): Fatura | null {
    const row = this.db
      .prepare('SELECT * FROM fatura WHERE cartao_id = ? AND mes_referencia = ?')
      .get(cartaoId, mesReferencia) as FaturaRow | undefined
    return row ? mapRow(row) : null
  }

  list(cartaoId?: number): Fatura[] {
    const rows = (
      cartaoId === undefined
        ? this.db.prepare('SELECT * FROM fatura ORDER BY mes_referencia, cartao_id').all()
        : this.db
            .prepare('SELECT * FROM fatura WHERE cartao_id = ? ORDER BY mes_referencia')
            .all(cartaoId)
    ) as FaturaRow[]
    return rows.map(mapRow)
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
    const dataFechamento = dataDoMes(ref.ano, ref.mes, cartao.diaFechamento)
    const dataVencimento = dataDoMes(ref.ano, ref.mes, cartao.diaVencimento)

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
