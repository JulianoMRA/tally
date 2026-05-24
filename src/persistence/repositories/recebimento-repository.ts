import type { Database } from '../database'
import type { Recebimento, StatusRecebimento } from '../../domain/entities/recebimento'
import type {
  CriarRecebimentoAvulsoInput,
  ListarRecebimentosInput,
  RecebimentoComContexto
} from '../../shared/ipc/recebimento'
import type { Repository } from './types'
import { mapRecebimento, type RecebimentoRow } from './row-mappers'

export type CriarRecebimentoInput = {
  rendaId: number | null
  valorCentavos: number
  dataEsperada: string
  dataRecebida?: string | null
}

export class RecebimentoRepository implements Repository {
  constructor(public readonly db: Database) {}

  findById(id: number): Recebimento | null {
    const row = this.db.prepare('SELECT * FROM recebimento WHERE id = ?').get(id) as
      | RecebimentoRow
      | undefined
    return row ? mapRecebimento(row) : null
  }

  criar(input: CriarRecebimentoInput): Recebimento {
    if (!Number.isInteger(input.valorCentavos) || input.valorCentavos <= 0) {
      throw new Error(`valorCentavos deve ser inteiro > 0, recebido: ${input.valorCentavos}`)
    }
    const status: StatusRecebimento = input.dataRecebida ? 'Recebido' : 'Esperado'
    const info = this.db
      .prepare(
        `INSERT INTO recebimento (renda_id, valor_centavos, data_esperada, data_recebida, status)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        input.rendaId,
        input.valorCentavos,
        input.dataEsperada,
        input.dataRecebida ?? null,
        status
      )
    const recebimento = this.findById(Number(info.lastInsertRowid))
    if (!recebimento) throw new Error('Falha ao recuperar recebimento após criar')
    return recebimento
  }

  /**
   * Cria um recebimento avulso. Internamente cria uma `renda` Avulsa com o
   * nome informado para preservar o vínculo de descrição → entrada.
   */
  criarAvulsoCompleto(input: CriarRecebimentoAvulsoInput): Recebimento {
    return this.db.transaction(() => {
      const rendaInfo = this.db
        .prepare(
          `INSERT INTO renda (nome, tipo, valor_padrao_centavos, dia_esperado)
           VALUES (?, 'Avulsa', ?, NULL)`
        )
        .run(input.nome, input.valorCentavos)
      const rendaId = Number(rendaInfo.lastInsertRowid)

      return this.criar({
        rendaId,
        valorCentavos: input.valorCentavos,
        dataEsperada: input.dataEsperada,
        dataRecebida: input.dataRecebida ?? null
      })
    })()
  }

  listar(input?: ListarRecebimentosInput): RecebimentoComContexto[] {
    type Row = RecebimentoRow & {
      renda_nome: string | null
    }

    let sql = `
      SELECT
        r.*,
        rd.nome AS renda_nome
      FROM recebimento r
      LEFT JOIN renda rd ON rd.id = r.renda_id
    `
    const where: string[] = []
    const params: unknown[] = []
    if (input?.mesReferencia) {
      where.push('substr(r.data_esperada, 1, 7) = ?')
      params.push(input.mesReferencia)
    }
    if (input?.status) {
      where.push('r.status = ?')
      params.push(input.status)
    }
    if (where.length > 0) sql += ' WHERE ' + where.join(' AND ')
    sql += ' ORDER BY r.data_esperada ASC, r.id ASC'

    const rows = this.db.prepare(sql).all(...params) as Row[]
    return rows.map((r) => ({
      ...mapRecebimento(r),
      rendaNome: r.renda_nome
    }))
  }

  marcarRecebido(recebimentoId: number, dataRecebida: string): Recebimento {
    const info = this.db
      .prepare(
        `UPDATE recebimento
         SET status = 'Recebido', data_recebida = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(dataRecebida, recebimentoId)
    if (info.changes === 0) throw new Error(`Recebimento #${recebimentoId} não encontrado`)
    const recebimento = this.findById(recebimentoId)
    if (!recebimento) throw new Error(`Falha ao recuperar recebimento #${recebimentoId}`)
    return recebimento
  }

  excluir(recebimentoId: number): void {
    const info = this.db.prepare('DELETE FROM recebimento WHERE id = ?').run(recebimentoId)
    if (info.changes === 0) throw new Error(`Recebimento #${recebimentoId} não encontrado`)
  }

  totaisPorMes(mesReferencia: string): {
    totalEsperadoCentavos: number
    totalRecebidoCentavos: number
  } {
    const rows = this.db
      .prepare(
        `SELECT status, SUM(valor_centavos) AS total
         FROM recebimento
         WHERE substr(data_esperada, 1, 7) = ?
         GROUP BY status`
      )
      .all(mesReferencia) as { status: StatusRecebimento; total: number }[]

    let totalEsperadoCentavos = 0
    let totalRecebidoCentavos = 0
    for (const r of rows) {
      if (r.status === 'Esperado') totalEsperadoCentavos = r.total
      else if (r.status === 'Recebido') totalRecebidoCentavos = r.total
    }
    return { totalEsperadoCentavos, totalRecebidoCentavos }
  }
}
