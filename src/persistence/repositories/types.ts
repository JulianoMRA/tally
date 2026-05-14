import type Database from 'better-sqlite3'

/**
 * Contrato base de um repositório.
 *
 * Repositórios traduzem rows do SQLite ↔ entidades do domain. Conversões importantes:
 *   * INTEGER 0/1 ↔ boolean
 *   * `valor_centavos` (snake_case) ↔ `valorCentavos` (camelCase)
 *   * status string ↔ discriminated union (no caso de Fatura)
 *   * NULL ↔ null (nunca undefined em campos persistidos)
 *
 * Implementações recebem o handle do banco por injeção (não abrem o banco).
 */
export interface Repository {
  readonly db: Database.Database
}

export type RowMapper<TRow, TEntity> = (row: TRow) => TEntity
