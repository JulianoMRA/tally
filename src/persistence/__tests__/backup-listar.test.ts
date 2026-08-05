import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backupDatabase, listarBackups } from '../backup'

/**
 * O app criava cópias no boot e na saída, mas não havia como listá-las nem
 * restaurá-las pela interface — só apagando arquivo na mão. `listarBackups` é a
 * leitura que faltava para o painel de Ajustes.
 */
describe('listarBackups', () => {
  let dir: string
  let dbPath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tally-backup-'))
    dbPath = join(dir, 'tally.db')
    writeFileSync(dbPath, 'conteudo')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('devolve lista vazia quando a pasta de backups nem existe', () => {
    expect(listarBackups(dbPath)).toEqual([])
  })

  it('devolve lista vazia quando a pasta existe mas está vazia', () => {
    mkdirSync(join(dir, 'backups'), { recursive: true })

    expect(listarBackups(dbPath)).toEqual([])
  })

  it('lista as cópias da mais recente para a mais antiga', () => {
    backupDatabase(dbPath, { now: new Date('2026-08-01T10:00:00Z') })
    backupDatabase(dbPath, { now: new Date('2026-08-03T10:00:00Z') })
    backupDatabase(dbPath, { now: new Date('2026-08-02T10:00:00Z') })

    const copias = listarBackups(dbPath)

    expect(copias).toHaveLength(3)
    expect(copias.map((c) => c.criadoEm)).toEqual([
      '2026-08-03T10:00:00.000Z',
      '2026-08-02T10:00:00.000Z',
      '2026-08-01T10:00:00.000Z'
    ])
  })

  it('devolve caminho absoluto e tamanho de cada cópia', () => {
    backupDatabase(dbPath, { now: new Date('2026-08-01T10:00:00Z') })

    const [copia] = listarBackups(dbPath)

    expect(copia.caminho).toContain('backups')
    expect(copia.tamanhoBytes).toBe('conteudo'.length)
  })

  it('respeita a pasta configurada pelo usuário', () => {
    const outra = join(dir, 'minha-pasta')
    backupDatabase(dbPath, { backupsDir: outra, now: new Date('2026-08-01T10:00:00Z') })

    expect(listarBackups(dbPath, outra)).toHaveLength(1)
    // A pasta padrão continua vazia.
    expect(listarBackups(dbPath)).toEqual([])
  })

  it('ignora arquivos que não são cópia do Tally', () => {
    backupDatabase(dbPath, { now: new Date('2026-08-01T10:00:00Z') })
    writeFileSync(join(dir, 'backups', 'anotacao.txt'), 'nao sou backup')

    expect(listarBackups(dbPath)).toHaveLength(1)
  })
})
