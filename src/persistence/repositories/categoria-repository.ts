import type { Database } from '../database'
import type { Categoria } from '../../domain/entities/categoria'
import type { CategoriaInput, ListCategoriaOptions } from '../../shared/ipc/categoria'
import type { Repository } from './types'
import { mapCategoria, type CategoriaRow } from './row-mappers'

export class CategoriaRepository implements Repository {
  constructor(public readonly db: Database) {}

  findById(id: number): Categoria | null {
    const row = this.db.prepare('SELECT * FROM categoria WHERE id = ?').get(id) as
      | CategoriaRow
      | undefined
    return row ? mapCategoria(row) : null
  }

  list(options?: ListCategoriaOptions): Categoria[] {
    const incluirArquivados = options?.incluirArquivados ?? false
    const tipo = options?.tipo

    let sql = 'SELECT * FROM categoria WHERE 1=1'
    const params: (string | number)[] = []

    if (!incluirArquivados) {
      sql += ' AND ativo = 1'
    }

    if (tipo) {
      sql += ' AND (tipo = ? OR tipo = ?)'
      params.push(tipo, 'Ambos')
    }

    sql += ' ORDER BY nome ASC'

    const rows = this.db.prepare(sql).all(...params) as CategoriaRow[]
    return rows.map(mapCategoria)
  }

  create(input: CategoriaInput): Categoria {
    const info = this.db
      .prepare('INSERT INTO categoria (nome, tipo, cor) VALUES (?, ?, ?)')
      .run(input.nome, input.tipo, input.cor)
    const categoria = this.findById(Number(info.lastInsertRowid))
    if (!categoria) throw new Error('Falha ao recuperar categoria após create')
    return categoria
  }

  update(id: number, input: CategoriaInput): Categoria {
    const info = this.db
      .prepare(
        `UPDATE categoria
         SET nome = ?, tipo = ?, cor = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(input.nome, input.tipo, input.cor, id)
    if (info.changes === 0) throw new Error(`Categoria #${id} não encontrada`)
    const categoria = this.findById(id)
    if (!categoria) throw new Error(`Falha ao recuperar categoria #${id} após update`)
    return categoria
  }

  arquivar(id: number): Categoria {
    this.db
      .prepare('UPDATE categoria SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(id)
    const categoria = this.findById(id)
    if (!categoria) throw new Error(`Categoria #${id} não encontrada`)
    return categoria
  }

  desarquivar(id: number): Categoria {
    this.db
      .prepare('UPDATE categoria SET ativo = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(id)
    const categoria = this.findById(id)
    if (!categoria) throw new Error(`Categoria #${id} não encontrada`)
    return categoria
  }
}
