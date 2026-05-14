import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type Database from 'better-sqlite3'

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

export function runMigrations(
  db: Database.Database,
  files: MigrationFile[] = loadMigrationFiles()
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

    const apply = db.transaction(() => {
      db.exec(file.sql)
      insertStmt.run(file.version, file.checksum)
    })
    apply()
    applied.push(file.version)
  }

  return { applied, skipped }
}
