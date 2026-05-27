import type { Database } from '../database'
import type { Cartao } from '../../domain/entities/cartao'
import type { CartaoInput, ListCartaoOptions } from '../../shared/ipc/cartao'
import type { Repository } from './types'
import { mapCartao, type CartaoRow } from './row-mappers'

export class CartaoRepository implements Repository {
  constructor(public readonly db: Database) {}

  findById(id: number): Cartao | null {
    const row = this.db.prepare('SELECT * FROM cartao WHERE id = ?').get(id) as
      | CartaoRow
      | undefined
    return row ? mapCartao(row) : null
  }

  list(options?: ListCartaoOptions): Cartao[] {
    const incluirArquivados = options?.incluirArquivados ?? false
    const sql = incluirArquivados
      ? 'SELECT * FROM cartao ORDER BY nome ASC'
      : 'SELECT * FROM cartao WHERE ativo = 1 ORDER BY nome ASC'
    const rows = this.db.prepare(sql).all() as CartaoRow[]
    return rows.map(mapCartao)
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
