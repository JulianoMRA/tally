import type { Database } from '../database'
import type { Orcamento } from '../../domain/entities/orcamento'
import type { LimiteCategoria } from '../../domain/services/calcular-orcamento'
import type { Repository } from './types'
import { mapOrcamento, type OrcamentoRow } from './row-mappers'

export class OrcamentoRepository implements Repository {
  constructor(public readonly db: Database) {}

  findByCategoria(categoriaId: number): Orcamento | null {
    const row = this.db
      .prepare('SELECT * FROM orcamento WHERE categoria_id = ? AND mes_referencia IS NULL')
      .get(categoriaId) as OrcamentoRow | undefined
    return row ? mapOrcamento(row) : null
  }

  /** Limites globais com nome e cor da categoria (JOIN), ordenados por nome. */
  listarLimitesGlobais(): LimiteCategoria[] {
    type Row = {
      categoria_id: number
      nome: string
      cor: string
      valor_limite_centavos: number
    }
    const rows = this.db
      .prepare(
        `SELECT o.categoria_id, c.nome, c.cor, o.valor_limite_centavos
         FROM orcamento o
         INNER JOIN categoria c ON c.id = o.categoria_id
         WHERE o.mes_referencia IS NULL
         ORDER BY c.nome ASC`
      )
      .all() as Row[]

    return rows.map((r) => ({
      categoriaId: r.categoria_id,
      categoriaNome: r.nome,
      cor: r.cor,
      limiteCentavos: r.valor_limite_centavos
    }))
  }

  /** Upsert do limite global da categoria (mes_referencia NULL). */
  definirLimite(categoriaId: number, valorLimiteCentavos: number): Orcamento {
    this.db
      .prepare(
        `INSERT INTO orcamento (categoria_id, mes_referencia, valor_limite_centavos)
         VALUES (?, NULL, ?)
         ON CONFLICT (categoria_id) WHERE mes_referencia IS NULL
         DO UPDATE SET valor_limite_centavos = excluded.valor_limite_centavos,
                       updated_at = CURRENT_TIMESTAMP`
      )
      .run(categoriaId, valorLimiteCentavos)
    const orcamento = this.findByCategoria(categoriaId)
    if (!orcamento) throw new Error('Falha ao recuperar orçamento após definirLimite')
    return orcamento
  }

  removerLimite(categoriaId: number): void {
    this.db
      .prepare('DELETE FROM orcamento WHERE categoria_id = ? AND mes_referencia IS NULL')
      .run(categoriaId)
  }
}
