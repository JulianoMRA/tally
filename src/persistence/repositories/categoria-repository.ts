import type { Database } from '../database'
import type { Categoria, TipoCategoria } from '../../domain/entities/categoria'
import type { CategoriaInput, ListCategoriaOptions } from '../../shared/ipc/categoria'
import type { Repository } from './types'

type CategoriaRow = {
  id: number
  nome: string
  tipo: TipoCategoria
  cor: string
  icone: string | null
  ativo: 0 | 1
  created_at: string
  updated_at: string
}

function mapRow(row: CategoriaRow): Categoria {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    cor: row.cor,
    icone: row.icone,
    ativo: row.ativo === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class CategoriaRepository implements Repository {
  constructor(public readonly db: Database) {}

  findById(id: number): Categoria | null {
    const row = this.db.prepare('SELECT * FROM categoria WHERE id = ?').get(id) as
      | CategoriaRow
      | undefined
    return row ? mapRow(row) : null
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
    return rows.map(mapRow)
  }

  create(input: CategoriaInput): Categoria {
    const info = this.db
      .prepare('INSERT INTO categoria (nome, tipo, cor, icone) VALUES (?, ?, ?, ?)')
      .run(input.nome, input.tipo, input.cor, input.icone ?? null)
    const categoria = this.findById(Number(info.lastInsertRowid))
    if (!categoria) throw new Error('Falha ao recuperar categoria após create')
    return categoria
  }

  update(id: number, input: CategoriaInput): Categoria {
    const info = this.db
      .prepare(
        `UPDATE categoria
         SET nome = ?, tipo = ?, cor = ?, icone = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(input.nome, input.tipo, input.cor, input.icone ?? null, id)
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
