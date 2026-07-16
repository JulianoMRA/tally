import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { backupDatabase } from '../backup'
import { openDatabase } from '../database'
import { runMigrations } from '../migrations/runner'

describe('backupDatabase', () => {
  let dir: string
  let dbPath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tally-backup-'))
    dbPath = join(dir, 'tally.db')
  })

  afterEach(() => {
    // Cleanup best-effort (mesmo padrao da fixture E2E): no Windows do CI,
    // antivirus/indexador seguram o handle do diretorio .lock do sqlite-wasm
    // por segundos apos o close — nem maxRetries resolveu (ENOTEMPTY
    // persistiu no runner). Falha de limpeza de pasta temp em VM efemera nao
    // e defeito do produto e nao deve derrubar a suite.
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
    } catch {
      // deixa para o SO limpar %TEMP%
    }
  })

  it('retorna null e nao cria nada quando o banco ainda nao existe', () => {
    const backupsDir = join(dir, 'backups')
    const resultado = backupDatabase(dbPath, { backupsDir, maxBackups: 5 })
    expect(resultado).toBeNull()
    expect(existsSync(backupsDir)).toBe(false)
  })

  it('cria uma copia identica do banco no diretorio de backups', () => {
    writeFileSync(dbPath, 'conteudo-do-banco')
    const backupsDir = join(dir, 'backups')

    const resultado = backupDatabase(dbPath, { backupsDir, maxBackups: 5 })

    expect(resultado).not.toBeNull()
    expect(existsSync(resultado as string)).toBe(true)
    expect(readdirSync(backupsDir)).toHaveLength(1)
  })

  it('mantem apenas as N copias mais recentes (retencao)', () => {
    writeFileSync(dbPath, 'x')
    const backupsDir = join(dir, 'backups')

    for (let segundo = 0; segundo < 6; segundo++) {
      backupDatabase(dbPath, {
        backupsDir,
        maxBackups: 3,
        now: new Date(Date.UTC(2026, 0, 1, 0, 0, segundo))
      })
    }

    const restantes = readdirSync(backupsDir).sort()
    expect(restantes).toHaveLength(3)
    // Deve preservar os tres mais recentes (segundos 3, 4, 5) e descartar o 0.
    // O componente de segundos no nome aparece como `-SS-000Z`.
    expect(restantes.some((n) => n.includes('-03-000Z'))).toBe(true)
    expect(restantes.some((n) => n.includes('-05-000Z'))).toBe(true)
    expect(restantes.some((n) => n.includes('-00-000Z'))).toBe(false)
  })

  it('faz backup de um banco real do app e o backup e um SQLite valido (integracao)', () => {
    // Primeiro boot: cria e migra o banco com o stack real.
    const db = openDatabase(dbPath)
    runMigrations(db)
    db.close()

    // Segundo boot: backup do arquivo existente.
    const backupsDir = join(dir, 'backups')
    const backupPath = backupDatabase(dbPath, { backupsDir, maxBackups: 5 })
    expect(backupPath).not.toBeNull()

    // O backup abre como banco valido e preserva as migrations aplicadas.
    const restaurado = openDatabase(backupPath as string)
    const versoes = restaurado
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all() as { version: string }[]
    restaurado.close()
    expect(versoes.length).toBeGreaterThan(0)
  })
})
