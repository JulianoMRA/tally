import { describe, it, expect } from 'vitest'
import { openInMemoryDatabase } from '../database'
import { buildMigrationFile, runMigrations } from '../migrations/runner'

describe('runMigrations', () => {
  it('aplica migrations pendentes e registra em schema_migrations', () => {
    const db = openInMemoryDatabase()
    const files = [
      buildMigrationFile('0001_a', 'CREATE TABLE a (id INTEGER PRIMARY KEY);'),
      buildMigrationFile('0002_b', 'CREATE TABLE b (id INTEGER PRIMARY KEY);')
    ]

    const result = runMigrations(db, files)

    expect(result.applied).toEqual(['0001_a', '0002_b'])
    expect(result.skipped).toEqual([])

    const rows = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as {
      version: string
    }[]
    expect(rows.map((r) => r.version)).toEqual(['0001_a', '0002_b'])

    db.close()
  })

  it('é idempotente — segunda execução pula tudo', () => {
    const db = openInMemoryDatabase()
    const files = [buildMigrationFile('0001_a', 'CREATE TABLE a (id INTEGER PRIMARY KEY);')]

    runMigrations(db, files)
    const second = runMigrations(db, files)

    expect(second.applied).toEqual([])
    expect(second.skipped).toEqual(['0001_a'])
    db.close()
  })

  it('falha se uma migration já aplicada teve seu conteúdo alterado', () => {
    const db = openInMemoryDatabase()
    const original = buildMigrationFile('0001_a', 'CREATE TABLE a (id INTEGER PRIMARY KEY);')
    runMigrations(db, [original])

    const tampered = buildMigrationFile(
      '0001_a',
      'CREATE TABLE a (id INTEGER PRIMARY KEY, extra TEXT);'
    )

    expect(() => runMigrations(db, [tampered])).toThrow(/imutáveis/)
    db.close()
  })

  it('reverte a migration inteira em caso de erro de SQL (transação)', () => {
    const db = openInMemoryDatabase()
    const broken = buildMigrationFile(
      '0001_broken',
      'CREATE TABLE ok (id INTEGER PRIMARY KEY); INVALID SQL HERE;'
    )

    expect(() => runMigrations(db, [broken])).toThrow()

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ok'")
      .all()
    expect(tables).toEqual([])

    const versions = db.prepare('SELECT version FROM schema_migrations').all()
    expect(versions).toEqual([])
    db.close()
  })
})
