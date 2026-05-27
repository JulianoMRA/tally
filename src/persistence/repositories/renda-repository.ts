import type { Database } from '../database'
import type { Renda } from '../../domain/entities/renda'
import type { Recebimento } from '../../domain/entities/recebimento'
import type {
  CriarRendaAvulsaInput,
  CriarRendaRecorrenteInput,
  UpdateRendaInput,
  ListRendaOptions
} from '../../shared/ipc/renda'
import type { Repository } from './types'
import { calcularExtensaoNecessaria } from '../../domain/services/calcular-extensao-horizonte'
import { gerarRecebimentosRecorrentes } from '../../domain/services/gerar-recebimentos-recorrentes'
import { clampDiaNoMes } from '../../domain/services/mes-referencia'
import { mapRenda, mapRecebimento, type RendaRow, type RecebimentoRow } from './row-mappers'

const HORIZONTE_RECEBIMENTOS_MESES = 12

export type ResultadoCriarRecorrente = {
  renda: Renda
  recebimentos: Recebimento[]
}

export class RendaRepository implements Repository {
  constructor(public readonly db: Database) {}

  findById(id: number): Renda | null {
    const row = this.db.prepare('SELECT * FROM renda WHERE id = ?').get(id) as RendaRow | undefined
    return row ? mapRenda(row) : null
  }

  list(options?: ListRendaOptions): Renda[] {
    const incluirArquivadas = options?.incluirArquivadas ?? false
    const sql = incluirArquivadas
      ? 'SELECT * FROM renda ORDER BY ativa DESC, nome ASC'
      : 'SELECT * FROM renda WHERE ativa = 1 ORDER BY nome ASC'
    const rows = this.db.prepare(sql).all() as RendaRow[]
    return rows.map(mapRenda)
  }

  criarAvulsa(input: CriarRendaAvulsaInput): Renda {
    const info = this.db
      .prepare(
        `INSERT INTO renda (nome, tipo, valor_padrao_centavos, dia_esperado)
         VALUES (?, 'Avulsa', ?, NULL)`
      )
      .run(input.nome, input.valorPadraoCentavos)
    const renda = this.findById(Number(info.lastInsertRowid))
    if (!renda) throw new Error('Falha ao recuperar renda após criar')
    return renda
  }

  criarRecorrente(input: CriarRendaRecorrenteInput): ResultadoCriarRecorrente {
    const planejados = gerarRecebimentosRecorrentes({
      dataInicio: input.dataInicio,
      valorPadraoCentavos: input.valorPadraoCentavos,
      diaEsperado: input.diaEsperado,
      quantidade: HORIZONTE_RECEBIMENTOS_MESES
    })

    return this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO renda (nome, tipo, valor_padrao_centavos, dia_esperado)
           VALUES (?, 'Recorrente', ?, ?)`
        )
        .run(input.nome, input.valorPadraoCentavos, input.diaEsperado)

      const renda = this.findById(Number(info.lastInsertRowid))
      if (!renda) throw new Error('Falha ao recuperar renda após criar')

      const insert = this.db.prepare(
        `INSERT INTO recebimento (renda_id, valor_centavos, data_esperada, status)
         VALUES (?, ?, ?, 'Esperado')`
      )
      const recebimentos: Recebimento[] = []
      for (const p of planejados) {
        const r = insert.run(renda.id, p.valorCentavos, p.dataEsperada)
        const row = this.db
          .prepare('SELECT * FROM recebimento WHERE id = ?')
          .get(Number(r.lastInsertRowid)) as RecebimentoRow
        recebimentos.push(mapRecebimento(row))
      }

      return { renda, recebimentos }
    })()
  }

  update(id: number, input: UpdateRendaInput): Renda {
    const existente = this.findById(id)
    if (!existente) throw new Error(`Renda #${id} não encontrada`)

    // Para Recorrente: se diaEsperado vier no input, valida e usa; senão mantém existente.
    // Para Avulsa: diaEsperado sempre permanece null (ignorado).
    const novoDiaEsperado =
      existente.tipo === 'Recorrente' && input.diaEsperado !== undefined
        ? input.diaEsperado
        : existente.diaEsperado

    return this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE renda
           SET nome = ?, valor_padrao_centavos = ?, dia_esperado = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .run(input.nome, input.valorPadraoCentavos, novoDiaEsperado, id)

      // RF-REN-05: reajuste do valor padrão afeta recebimentos futuros ainda Esperado
      if (
        existente.tipo === 'Recorrente' &&
        existente.valorPadraoCentavos !== input.valorPadraoCentavos
      ) {
        this.db
          .prepare(
            `UPDATE recebimento
             SET valor_centavos = ?, updated_at = CURRENT_TIMESTAMP
             WHERE renda_id = ? AND status = 'Esperado'`
          )
          .run(input.valorPadraoCentavos, id)
      }

      // RF-REN-06: mudar diaEsperado recalcula data_esperada dos Esperados
      if (
        existente.tipo === 'Recorrente' &&
        novoDiaEsperado !== null &&
        novoDiaEsperado !== existente.diaEsperado
      ) {
        const esperados = this.db
          .prepare(
            `SELECT id, data_esperada FROM recebimento WHERE renda_id = ? AND status = 'Esperado'`
          )
          .all(id) as { id: number; data_esperada: string }[]
        const updData = this.db.prepare(
          `UPDATE recebimento SET data_esperada = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        )
        for (const e of esperados) {
          const [ano, mes] = e.data_esperada.split('-').map(Number)
          const novaData = clampDiaNoMes(ano, mes, novoDiaEsperado)
          updData.run(novaData, e.id)
        }
      }

      const atualizada = this.findById(id)
      if (!atualizada) throw new Error(`Falha ao recuperar renda #${id} após update`)
      return atualizada
    })()
  }

  arquivar(id: number): Renda {
    return this.db.transaction(() => {
      // Apaga recebimentos futuros Esperado, preserva Recebido (histórico)
      this.db.prepare(`DELETE FROM recebimento WHERE renda_id = ? AND status = 'Esperado'`).run(id)
      this.db
        .prepare('UPDATE renda SET ativa = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(id)
      const renda = this.findById(id)
      if (!renda) throw new Error(`Renda #${id} não encontrada`)
      return renda
    })()
  }

  desarquivar(id: number): Renda {
    this.db
      .prepare('UPDATE renda SET ativa = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(id)
    const renda = this.findById(id)
    if (!renda) throw new Error(`Renda #${id} não encontrada`)
    return renda
  }

  /**
   * RF-VIS-04, RN-04 — estende preguiçosamente o horizonte de recebimentos
   * das rendas recorrentes ativas até alcançar `mesAlvo`. Idempotente,
   * forward-only. Avulsas e arquivadas são ignoradas.
   */
  estenderHorizonteRecorrentes(mesAlvo: string): { recebimentosCriados: number } {
    type RecorrenteRow = RendaRow & {
      ultimo_mes: string | null
      total_existentes: number
    }
    const recorrentes = this.db
      .prepare(
        `SELECT r.*,
                (SELECT MAX(substr(data_esperada, 1, 7)) FROM recebimento
                   WHERE renda_id = r.id) AS ultimo_mes,
                (SELECT COUNT(*) FROM recebimento WHERE renda_id = r.id) AS total_existentes
         FROM renda r
         WHERE r.tipo = 'Recorrente' AND r.ativa = 1`
      )
      .all() as RecorrenteRow[]

    return this.db.transaction(() => {
      let recebimentosCriados = 0
      const insert = this.db.prepare(
        `INSERT INTO recebimento (renda_id, valor_centavos, data_esperada, status)
         VALUES (?, ?, ?, 'Esperado')`
      )

      for (const r of recorrentes) {
        if (r.dia_esperado === null) continue

        const extensao = calcularExtensaoNecessaria({
          mesAlvo,
          ultimoMesExistente: r.ultimo_mes,
          ultimoNumeroExistente: r.ultimo_mes === null ? null : r.total_existentes
        })
        if (!extensao) continue

        const planejados = gerarRecebimentosRecorrentes({
          dataInicio: `${extensao.mesReferenciaInicial}-01`,
          valorPadraoCentavos: r.valor_padrao_centavos,
          diaEsperado: r.dia_esperado,
          quantidade: extensao.quantidade
        })

        for (const p of planejados) {
          insert.run(r.id, p.valorCentavos, p.dataEsperada)
          recebimentosCriados++
        }
      }

      return { recebimentosCriados }
    })()
  }
}
