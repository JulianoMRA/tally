import type { Database } from '../database'
import type { Tag } from '../../domain/entities/tag'
import type { Repository } from './types'
import { mapTag, type TagRow } from './row-mappers'

/** Normaliza nome de tag: apara espaços. Comparação de unicidade é NOCASE no schema. */
function normalizarNome(nome: string): string {
  return nome.trim()
}

export class TagRepository implements Repository {
  constructor(public readonly db: Database) {}

  /** Cria a tag (se nova) ou devolve a existente (match case-insensitive). */
  upsertPorNome(nome: string): Tag {
    const limpo = normalizarNome(nome)
    if (limpo.length === 0) throw new Error('Nome de tag não pode ser vazio.')
    this.db.prepare('INSERT OR IGNORE INTO tag (nome) VALUES (?)').run(limpo)
    const row = this.db
      .prepare('SELECT * FROM tag WHERE nome = ? COLLATE NOCASE')
      .get(limpo) as TagRow
    return mapTag(row)
  }

  listar(): Tag[] {
    const rows = this.db
      .prepare('SELECT * FROM tag ORDER BY nome COLLATE NOCASE ASC')
      .all() as TagRow[]
    return rows.map(mapTag)
  }

  tagsDaDespesa(despesaId: number): Tag[] {
    const rows = this.db
      .prepare(
        `SELECT t.* FROM tag t
         INNER JOIN despesa_tag dt ON dt.tag_id = t.id
         WHERE dt.despesa_id = ?
         ORDER BY t.nome COLLATE NOCASE ASC`
      )
      .all(despesaId) as TagRow[]
    return rows.map(mapTag)
  }

  /** Mapa despesaId → nomes de tag, em uma query. Despesas sem tag ficam de fora. */
  tagsPorDespesaIds(ids: number[]): Map<number, string[]> {
    const mapa = new Map<number, string[]>()
    if (ids.length === 0) return mapa
    const placeholders = ids.map(() => '?').join(',')
    const rows = this.db
      .prepare(
        `SELECT dt.despesa_id, t.nome FROM despesa_tag dt
         INNER JOIN tag t ON t.id = dt.tag_id
         WHERE dt.despesa_id IN (${placeholders})
         ORDER BY t.nome COLLATE NOCASE ASC`
      )
      .all(...ids) as { despesa_id: number; nome: string }[]
    for (const row of rows) {
      const lista = mapa.get(row.despesa_id) ?? []
      lista.push(row.nome)
      mapa.set(row.despesa_id, lista)
    }
    return mapa
  }

  /**
   * Substitui o conjunto de tags de uma despesa: cria as que faltam, remove os
   * vínculos antigos e insere os novos. Nomes vazios ou duplicados (após
   * normalização/case) são ignorados. A tag em si nunca é apagada aqui — pode
   * ser compartilhada por outras despesas.
   */
  sincronizarDespesa(despesaId: number, nomes: string[]): void {
    const unicos = new Map<string, string>()
    for (const nome of nomes) {
      const limpo = normalizarNome(nome)
      if (limpo.length > 0) unicos.set(limpo.toLowerCase(), limpo)
    }

    this.db.transaction(() => {
      this.db.prepare('DELETE FROM despesa_tag WHERE despesa_id = ?').run(despesaId)
      const vincular = this.db.prepare(
        'INSERT OR IGNORE INTO despesa_tag (despesa_id, tag_id) VALUES (?, ?)'
      )
      for (const nome of unicos.values()) {
        const tag = this.upsertPorNome(nome)
        vincular.run(despesaId, tag.id)
      }
    })()
  }
}
