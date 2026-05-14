import type Database from 'better-sqlite3'
import type { Cartao } from '../../domain/entities/cartao'
import type { CartaoInput, ListCartaoOptions } from '../../shared/ipc/cartao'
import type { Repository } from './types'

type CartaoRow = {
  id: number
  nome: string
  dia_fechamento: number
  dia_vencimento: number
  cor: string
  ativo: 0 | 1
  created_at: string
  updated_at: string
}

function mapRow(row: CartaoRow): Cartao {
  return {
    id: row.id,
    nome: row.nome,
    diaFechamento: row.dia_fechamento,
    diaVencimento: row.dia_vencimento,
    cor: row.cor,
    ativo: row.ativo === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class CartaoRepository implements Repository {
  constructor(public readonly db: Database.Database) {}

  findById(id: number): Cartao | null {
    const row = this.db.prepare('SELECT * FROM cartao WHERE id = ?').get(id) as
      | CartaoRow
      | undefined
    return row ? mapRow(row) : null
  }

  list(options?: ListCartaoOptions): Cartao[] {
    const incluirArquivados = options?.incluirArquivados ?? false
    const sql = incluirArquivados
      ? 'SELECT * FROM cartao ORDER BY nome ASC'
      : 'SELECT * FROM cartao WHERE ativo = 1 ORDER BY nome ASC'
    const rows = this.db.prepare(sql).all() as CartaoRow[]
    return rows.map(mapRow)
  }

  create(input: CartaoInput): Cartao {
    const info = this.db
      .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)')
      .run(input.nome, input.diaFechamento, input.diaVencimento, input.cor)
    const cartao = this.findById(Number(info.lastInsertRowid))
    if (!cartao) throw new Error('Falha ao recuperar cartão após create')
    return cartao
  }

  update(id: number, input: CartaoInput): Cartao {
    const info = this.db
      .prepare(
        `UPDATE cartao
         SET nome = ?, dia_fechamento = ?, dia_vencimento = ?, cor = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(input.nome, input.diaFechamento, input.diaVencimento, input.cor, id)
    if (info.changes === 0) throw new Error(`Cartão #${id} não encontrado`)
    const cartao = this.findById(id)
    if (!cartao) throw new Error(`Falha ao recuperar cartão #${id} após update`)
    return cartao
  }

  arquivar(id: number): Cartao {
    this.db
      .prepare('UPDATE cartao SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(id)
    const cartao = this.findById(id)
    if (!cartao) throw new Error(`Cartão #${id} não encontrado`)
    return cartao
  }

  desarquivar(id: number): Cartao {
    this.db
      .prepare('UPDATE cartao SET ativo = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(id)
    const cartao = this.findById(id)
    if (!cartao) throw new Error(`Cartão #${id} não encontrado`)
    return cartao
  }
}
