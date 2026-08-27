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
  /** Fonte recorrente. Null para entrada avulsa, que traz `descricao`. */
  rendaId: number | null
  /** Nome proprio da entrada avulsa. Null quando vem de fonte. */
  descricao?: string | null
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
        `INSERT INTO recebimento (renda_id, descricao, valor_centavos, data_esperada, data_recebida, status)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.rendaId,
        input.descricao ?? null,
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
   * Cria uma entrada avulsa: nome proprio, sem fonte de renda.
   *
   * Ate a migration 0011 isto era obrigado a criar uma `renda` Avulsa, porque
   * `recebimento` nao tinha onde guardar um nome — e o efeito era uma fonte
   * nova por freela, com um `valor_padrao_centavos` que nao alimentava calculo
   * nenhum. Fonte de renda agora existe so para entrada constante.
   */
  criarAvulso(input: CriarRecebimentoAvulsoInput): Recebimento {
    return this.criar({
      rendaId: null,
      descricao: input.descricao,
      valorCentavos: input.valorCentavos,
      dataEsperada: input.dataEsperada,
      dataRecebida: input.dataRecebida ?? null
    })
  }

  listar(input?: ListarRecebimentosInput): RecebimentoComContexto[] {
    type Row = RecebimentoRow & {
      nome_resolvido: string
    }

    // O nome vem da fonte quando ha fonte, e da propria linha quando e avulsa.
    // O CHECK da 0011 garante que exatamente um dos dois existe, entao o
    // COALESCE nunca cai no terceiro argumento — ele esta ali so para o tipo
    // ser `string` e nao `string | null` do lado do TypeScript.
    let sql = `
      SELECT
        r.*,
        COALESCE(rd.nome, r.descricao, 'Sem descricao') AS nome_resolvido
      FROM recebimento r
      LEFT JOIN renda rd ON rd.id = r.renda_id
    `
    const where: string[] = []
    const params: string[] = []
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
      nome: r.nome_resolvido
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

  /**
   * Atualiza uma entrada avulsa: nome, valor e datas.
   *
   * So avulsa. Recebimento de fonte recorrente tem valor e data derivados da
   * fonte (RF-REN-05/06) — edita-lo por aqui criaria uma segunda verdade que
   * o proximo reajuste da fonte sobrescreveria sem avisar.
   */
  atualizar(input: {
    recebimentoId: number
    descricao: string
    valorCentavos: number
    dataEsperada: string
    dataRecebida?: string | null
  }): Recebimento {
    const existente = this.findById(input.recebimentoId)
    if (!existente) throw new Error(`Recebimento #${input.recebimentoId} nao encontrado`)
    if (existente.rendaId !== null) {
      throw new Error(
        'Este recebimento vem de uma fonte recorrente — edite a fonte para alterar valor ou dia.'
      )
    }
    if (!Number.isInteger(input.valorCentavos) || input.valorCentavos <= 0) {
      throw new Error(`valorCentavos deve ser inteiro > 0, recebido: ${input.valorCentavos}`)
    }

    const status: StatusRecebimento = input.dataRecebida ? 'Recebido' : 'Esperado'
    this.db
      .prepare(
        `UPDATE recebimento
         SET descricao = ?, valor_centavos = ?, data_esperada = ?, data_recebida = ?,
             status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(
        input.descricao,
        input.valorCentavos,
        input.dataEsperada,
        input.dataRecebida ?? null,
        status,
        input.recebimentoId
      )

    const atualizado = this.findById(input.recebimentoId)
    if (!atualizado) throw new Error(`Falha ao recuperar recebimento #${input.recebimentoId}`)
    return atualizado
  }

  /**
   * Exclui o recebimento.
   *
   * Antes isto tambem apagava a `renda` Avulsa quando ela ficava sem
   * recebimentos — limpeza que existia porque `criarAvulsoCompleto` criava a
   * fonte implicitamente. Desde a 0011 avulsa nao tem fonte, entao nao ha
   * orfa possivel e a transacao inteira deixou de ser necessaria.
   */
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
