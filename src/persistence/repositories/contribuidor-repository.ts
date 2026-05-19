import type { Database } from '../database'
import type { Contribuidor } from '../../domain/entities/contribuidor'
import type { ContribuidorInput, ListContribuidorOptions } from '../../shared/ipc/contribuidor'
import type { Repository } from './types'

type ContribuidorRow = {
  id: number
  nome: string
  contato: string | null
  ativo: 0 | 1
  created_at: string
  updated_at: string
}

function mapRow(row: ContribuidorRow): Contribuidor {
  return {
    id: row.id,
    nome: row.nome,
    contato: row.contato,
    ativo: row.ativo === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class ContribuidorRepository implements Repository {
  constructor(public readonly db: Database) {}

  findById(id: number): Contribuidor | null {
    const row = this.db.prepare('SELECT * FROM contribuidor WHERE id = ?').get(id) as
      | ContribuidorRow
      | undefined
    return row ? mapRow(row) : null
  }

  list(options?: ListContribuidorOptions): Contribuidor[] {
    const incluirArquivados = options?.incluirArquivados ?? false
    const sql = incluirArquivados
      ? 'SELECT * FROM contribuidor ORDER BY nome ASC'
      : 'SELECT * FROM contribuidor WHERE ativo = 1 ORDER BY nome ASC'
    const rows = this.db.prepare(sql).all() as ContribuidorRow[]
    return rows.map(mapRow)
  }

  create(input: ContribuidorInput): Contribuidor {
    const info = this.db
      .prepare('INSERT INTO contribuidor (nome, contato) VALUES (?, ?)')
      .run(input.nome, input.contato ?? null)
    const contribuidor = this.findById(Number(info.lastInsertRowid))
    if (!contribuidor) throw new Error('Falha ao recuperar contribuidor após create')
    return contribuidor
  }

  update(id: number, input: ContribuidorInput): Contribuidor {
    const info = this.db
      .prepare(
        `UPDATE contribuidor
         SET nome = ?, contato = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(input.nome, input.contato ?? null, id)
    if (info.changes === 0) throw new Error(`Contribuidor #${id} não encontrado`)
    const contribuidor = this.findById(id)
    if (!contribuidor) throw new Error(`Falha ao recuperar contribuidor #${id} após update`)
    return contribuidor
  }

  arquivar(id: number): Contribuidor {
    this.db
      .prepare('UPDATE contribuidor SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(id)
    const contribuidor = this.findById(id)
    if (!contribuidor) throw new Error(`Contribuidor #${id} não encontrado`)
    return contribuidor
  }

  desarquivar(id: number): Contribuidor {
    this.db
      .prepare('UPDATE contribuidor SET ativo = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(id)
    const contribuidor = this.findById(id)
    if (!contribuidor) throw new Error(`Contribuidor #${id} não encontrado`)
    return contribuidor
  }
}
