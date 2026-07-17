import type { Database } from '../database'
import type { Orcamento } from '../../domain/entities/orcamento'
import type { LimiteCategoria } from '../../domain/services/calcular-orcamento'
import type { Repository } from './types'
import { mapOrcamento, type OrcamentoRow } from './row-mappers'

export type OrigemLimite = 'mensal' | 'global'

export type LimiteEfetivo = LimiteCategoria & { origem: OrigemLimite }

export class OrcamentoRepository implements Repository {
  constructor(public readonly db: Database) {}

  findByCategoria(categoriaId: number, mesReferencia: string | null): Orcamento | null {
    const row = (
      mesReferencia === null
        ? this.db
            .prepare('SELECT * FROM orcamento WHERE categoria_id = ? AND mes_referencia IS NULL')
            .get(categoriaId)
        : this.db
            .prepare('SELECT * FROM orcamento WHERE categoria_id = ? AND mes_referencia = ?')
            .get(categoriaId, mesReferencia)
    ) as OrcamentoRow | undefined
    return row ? mapOrcamento(row) : null
  }

  /**
   * Limites vigentes para um mês: o limite mensal (quando existe) sobrepõe o
   * global da mesma categoria. Ordenado por nome da categoria.
   */
  listarLimitesEfetivos(mesReferencia: string): LimiteEfetivo[] {
    type Row = {
      categoria_id: number
      nome: string
      cor: string
      valor_limite_centavos: number
      mes_referencia: string | null
    }
    const rows = this.db
      .prepare(
        `SELECT o.categoria_id, c.nome, c.cor, o.valor_limite_centavos, o.mes_referencia
         FROM orcamento o
         INNER JOIN categoria c ON c.id = o.categoria_id
         WHERE o.mes_referencia IS NULL OR o.mes_referencia = ?
         ORDER BY c.nome ASC`
      )
      .all(mesReferencia) as Row[]

    const porCategoria = new Map<number, Row>()
    for (const row of rows) {
      const existente = porCategoria.get(row.categoria_id)
      if (!existente || row.mes_referencia !== null) {
        porCategoria.set(row.categoria_id, row)
      }
    }

    return [...porCategoria.values()]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((r) => ({
        categoriaId: r.categoria_id,
        categoriaNome: r.nome,
        cor: r.cor,
        limiteCentavos: r.valor_limite_centavos,
        origem: r.mes_referencia === null ? ('global' as const) : ('mensal' as const)
      }))
  }

  /**
   * Upsert do limite da categoria no escopo dado: mes null = global (índice
   * parcial ux_orcamento_global), mes preenchido = daquele mês (ux_orcamento_mes).
   */
  definirLimite(
    categoriaId: number,
    valorLimiteCentavos: number,
    mesReferencia: string | null
  ): Orcamento {
    if (mesReferencia === null) {
      this.db
        .prepare(
          `INSERT INTO orcamento (categoria_id, mes_referencia, valor_limite_centavos)
           VALUES (?, NULL, ?)
           ON CONFLICT (categoria_id) WHERE mes_referencia IS NULL
           DO UPDATE SET valor_limite_centavos = excluded.valor_limite_centavos,
                         updated_at = CURRENT_TIMESTAMP`
        )
        .run(categoriaId, valorLimiteCentavos)
    } else {
      this.db
        .prepare(
          `INSERT INTO orcamento (categoria_id, mes_referencia, valor_limite_centavos)
           VALUES (?, ?, ?)
           ON CONFLICT (categoria_id, mes_referencia) WHERE mes_referencia IS NOT NULL
           DO UPDATE SET valor_limite_centavos = excluded.valor_limite_centavos,
                         updated_at = CURRENT_TIMESTAMP`
        )
        .run(categoriaId, mesReferencia, valorLimiteCentavos)
    }
    const orcamento = this.findByCategoria(categoriaId, mesReferencia)
    if (!orcamento) throw new Error('Falha ao recuperar orçamento após definirLimite')
    return orcamento
  }

  removerLimite(categoriaId: number, mesReferencia: string | null): void {
    if (mesReferencia === null) {
      this.db
        .prepare('DELETE FROM orcamento WHERE categoria_id = ? AND mes_referencia IS NULL')
        .run(categoriaId)
    } else {
      this.db
        .prepare('DELETE FROM orcamento WHERE categoria_id = ? AND mes_referencia = ?')
        .run(categoriaId, mesReferencia)
    }
  }
}
