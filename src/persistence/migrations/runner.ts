/// <reference types="vite/client" />
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Database } from '../database'

export type MigrationFile = {
  version: string
  filename: string
  sql: string
  checksum: string
}

export type MigrationResult = {
  applied: string[]
  skipped: string[]
}

const ENSURE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    checksum   TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )
`

const DEFAULT_SQL_DIR = join(dirname(fileURLToPath(import.meta.url)), 'sql')

/**
 * Carrega migrations inlinadas pelo Vite no momento do build.
 * Funciona tanto em Vitest (dev/teste) quanto no bundle CJS do Electron,
 * dispensando o acesso ao filesystem em runtime.
 */
const BUNDLED_SQL = import.meta.glob('./sql/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

export function loadBundledMigrations(): MigrationFile[] {
  return Object.entries(BUNDLED_SQL)
    .map(([path, sql]) => {
      const filename = path.split('/').pop() ?? path
      return {
        version: filename.replace(/\.sql$/, ''),
        filename,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex')
      }
    })
    .sort((a, b) => a.filename.localeCompare(b.filename))
}

export function loadMigrationFiles(dir: string = DEFAULT_SQL_DIR): MigrationFile[] {
  const entries = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  return entries.map((filename) => {
    const sql = readFileSync(join(dir, filename), 'utf8')
    const version = filename.replace(/\.sql$/, '')
    const checksum = createHash('sha256').update(sql).digest('hex')
    return { version, filename, sql, checksum }
  })
}

export function buildMigrationFile(version: string, sql: string): MigrationFile {
  return {
    version,
    filename: `${version}.sql`,
    sql,
    checksum: createHash('sha256').update(sql).digest('hex')
  }
}

/**
 * Migrations com a diretiva `-- @no-transaction` no header rodam FORA da
 * transação padrão. Necessário para PRAGMAs que precisam estar em modo
 * autocommit (ex.: `foreign_keys = OFF` para DROP de tabela referenciada).
 * Nesse modo a migration controla seu próprio BEGIN/COMMIT — se quebrar,
 * o estado do schema pode ficar parcial. Use com cuidado.
 */
const NO_TRANSACTION_DIRECTIVE = /^\s*--\s*@no-transaction\b/

export function runMigrations(
  db: Database,
  files: MigrationFile[] = loadBundledMigrations()
): MigrationResult {
  db.exec(ENSURE_TABLE_SQL)

  const selectStmt = db.prepare('SELECT version, checksum FROM schema_migrations WHERE version = ?')
  const insertStmt = db.prepare('INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)')

  const applied: string[] = []
  const skipped: string[] = []

  for (const file of files) {
    const existing = selectStmt.get(file.version) as
      | { version: string; checksum: string }
      | undefined

    if (existing) {
      if (existing.checksum !== file.checksum) {
        throw new Error(
          `Migration ${file.filename} foi alterada após ser aplicada ` +
            `(checksum esperado ${existing.checksum}, atual ${file.checksum}). ` +
            `Migrations aplicadas são imutáveis — crie uma nova migration.`
        )
      }
      skipped.push(file.version)
      continue
    }

    if (NO_TRANSACTION_DIRECTIVE.test(file.sql)) {
      // Migration controla seu próprio BEGIN/COMMIT (ou roda em autocommit).
      // Inserimos em schema_migrations só depois — se a migration quebrou no
      // meio, o checksum não é registrado e o próximo boot tentará reaplicar
      // (com schema parcial, vai quebrar de novo com mensagem clara).
      db.exec(file.sql)
      insertStmt.run(file.version, file.checksum)
    } else {
      const apply = db.transaction(() => {
        db.exec(file.sql)
        insertStmt.run(file.version, file.checksum)
      })
      apply()
    }
    applied.push(file.version)
  }

  return { applied, skipped }
}
