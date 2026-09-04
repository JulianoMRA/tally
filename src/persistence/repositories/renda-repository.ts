import type { Database } from '../database'
import type { Renda } from '../../domain/entities/renda'
import type { Recebimento } from '../../domain/entities/recebimento'
import type {
  CriarRendaRecorrenteInput,
  UpdateRendaInput,
  ListRendaOptions
} from '../../shared/ipc/renda'
import type { Repository } from './types'
import { calcularExtensaoNecessaria } from '../../domain/services/calcular-extensao-horizonte'
import { gerarRecebimentosRecorrentes } from '../../domain/services/gerar-recebimentos-recorrentes'
import { clampDiaNoMes } from '../../domain/services/mes-referencia'
import { hojeIsoLocal } from '../../shared/datas-locais'
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

  /**
   * RF-REN-09 — desarquivar reativa a fonte E regenera o horizonte a partir de
   * hoje, espelhando o `arquivar`: ele apaga o futuro, este o recria.
   *
   * Sem a regeneração, uma fonte que nunca teve recebimento Recebido voltava
   * sterilizada: `arquivar` apagou todos os Esperado, o
   * `estenderHorizonteRecorrentes` deriva o ponto de partida de
   * `MAX(data_esperada)` — que virava NULL — e o `calcularExtensaoNecessaria`
   * devolve null nesse caso. A fonte reaparecia na lista como ativa e não
   * alimentava mês nenhum, para sempre, contra a RF-REN-02.
   *
   * Não dá para deixar isso a cargo do horizonte preguiçoso: ele só roda para
   * mês FUTURO (`estenderHorizonteSeNecessario` volta cedo quando
   * `mesesAdiante <= 0`), então a fonte seguiria invisível no mês corrente até
   * o usuário navegar adiante.
   *
   * `hoje` é injetável para teste determinístico — mesmo padrão do `backup.ts`.
   */
  desarquivar(id: number, hoje: string = hojeIsoLocal()): Renda {
    return this.db.transaction(() => {
      const anterior = this.findById(id)
      if (!anterior) throw new Error(`Renda #${id} não encontrada`)

      this.db
        .prepare('UPDATE renda SET ativa = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(id)
      const renda = this.findById(id)
      if (!renda) throw new Error(`Renda #${id} não encontrada`)

      // Só semeia quando a fonte estava DE FATO arquivada. Desarquivar uma
      // fonte já ativa é no-op do ponto de vista do usuário, e semear ali
      // esticaria o horizonte alguns meses como efeito colateral silencioso.
      if (!anterior.ativa) this.semearHorizonte(renda, hoje)
      return renda
    })()
  }

  /**
   * Recria o horizonte de uma fonte recorrente a partir de `hoje`, pulando os
   * meses que já têm recebimento.
   *
   * O salto é o que torna a operação segura de repetir e o que protege o
   * Recebido que o `arquivar` preservou: sem ele, um recebimento marcado como
   * recebido num mês futuro ganharia um Esperado irmão, e o mês contaria a
   * mesma entrada duas vezes.
   *
   * Valor zero é possível no banco (`CHECK >= 0`) embora o schema de IPC exija
   * `min(1)`, e `gerarRecebimentosRecorrentes` recusa `<= 0`. Sair antes evita
   * que uma linha importada assim transforme o desarquivamento em erro.
   */
  private semearHorizonte(renda: Renda, hoje: string): void {
    if (renda.tipo !== 'Recorrente') return
    if (renda.diaEsperado === null) return
    if (renda.valorPadraoCentavos <= 0) return

    const planejados = gerarRecebimentosRecorrentes({
      dataInicio: hoje,
      valorPadraoCentavos: renda.valorPadraoCentavos,
      diaEsperado: renda.diaEsperado,
      quantidade: HORIZONTE_RECEBIMENTOS_MESES
    })

    const ocupados = new Set(
      (
        this.db
          .prepare(
            `SELECT DISTINCT substr(data_esperada, 1, 7) AS mes
             FROM recebimento WHERE renda_id = ?`
          )
          .all(renda.id) as { mes: string }[]
      ).map((r) => r.mes)
    )

    const insert = this.db.prepare(
      `INSERT INTO recebimento (renda_id, valor_centavos, data_esperada, status)
       VALUES (?, ?, ?, 'Esperado')`
    )
    for (const p of planejados) {
      if (ocupados.has(p.dataEsperada.slice(0, 7))) continue
      insert.run(renda.id, p.valorCentavos, p.dataEsperada)
    }
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
