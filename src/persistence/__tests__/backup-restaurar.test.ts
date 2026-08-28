import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import {
  backupDatabase,
  listarBackups,
  resolverBackupRestauravel,
  validarPastaDeBackups
} from '../backup'

/**
 * Guarda de restauração de backup.
 *
 * `restaurarBackup` recebia um caminho do renderer e fazia `copyFileSync` dele
 * por cima do banco, sem verificar nada além de o arquivo existir. Confused
 * deputy clássico: o main emprestava seu poder de escrever no disco para um
 * caminho que não escolheu.
 *
 * Severidade baixa no modelo de ameaça atual — o renderer não tem superfície
 * de injeção (zero `dangerouslySetInnerHTML`, zero `<a href>`, zero `eval`, CSP
 * estrita, `sandbox: true`) —, mas é defesa em profundidade barata, e protege
 * também contra um bug do renderer mandando o caminho errado.
 *
 * O invariante escolhido: **só se restaura o que o próprio app lista.** Uma
 * fonte de verdade só, herdando as regras de nome do `listarBackups`.
 */
describe('resolverBackupRestauravel', () => {
  let dir: string
  let dbPath: string
  let backupsDir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tally-restaurar-'))
    dbPath = join(dir, 'tally.db')
    writeFileSync(dbPath, 'banco original')
    backupsDir = join(dir, 'backups')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('aceita uma cópia que o listarBackups devolveria', () => {
    const criado = backupDatabase(dbPath, { backupsDir })
    expect(criado).not.toBeNull()

    expect(resolverBackupRestauravel(dbPath, backupsDir, criado!)).toBe(criado)
  })

  it('aceita o caminho com separadores normalizados', () => {
    const criado = backupDatabase(dbPath, { backupsDir })!
    // O renderer devolve a string que recebeu, mas o caminho pode chegar com
    // barras trocadas dependendo de quem o montou.
    const equivalente = criado.split(sep).join('/')

    expect(resolverBackupRestauravel(dbPath, backupsDir, equivalente)).toBe(criado)
  })

  describe('recusa o que a lista não contém', () => {
    it('arquivo fora da pasta de backups', () => {
      const intruso = join(dir, 'qualquer-coisa.db')
      writeFileSync(intruso, 'nao sou backup')

      expect(() => resolverBackupRestauravel(dbPath, backupsDir, intruso)).toThrow(
        /não está na pasta de backups/i
      )
    })

    it('o próprio banco — restaurar sobre si mesmo não é restauração', () => {
      expect(() => resolverBackupRestauravel(dbPath, backupsDir, dbPath)).toThrow()
    })

    it('travessia com .. saindo da pasta', () => {
      mkdirSync(backupsDir, { recursive: true })
      const travessia = join(backupsDir, '..', 'tally.db')

      expect(() => resolverBackupRestauravel(dbPath, backupsDir, travessia)).toThrow()
    })

    it('arquivo dentro da pasta mas com nome fora do padrão', () => {
      mkdirSync(backupsDir, { recursive: true })
      const impostor = join(backupsDir, 'nao-e-copia.db')
      writeFileSync(impostor, 'conteudo')

      // `listarBackups` só devolve `tally-<stamp>.db`, então este nunca aparece
      // na lista — e portanto não é restaurável.
      expect(() => resolverBackupRestauravel(dbPath, backupsDir, impostor)).toThrow()
    })

    it('extensão diferente, mesmo com o prefixo certo', () => {
      mkdirSync(backupsDir, { recursive: true })
      const impostor = join(backupsDir, 'tally-2026-08-01T10-00-00-000Z.txt')
      writeFileSync(impostor, 'conteudo')

      expect(() => resolverBackupRestauravel(dbPath, backupsDir, impostor)).toThrow()
    })

    it('caminho que não existe', () => {
      const fantasma = join(backupsDir, 'tally-2026-01-01T00-00-00-000Z.db')

      expect(() => resolverBackupRestauravel(dbPath, backupsDir, fantasma)).toThrow()
    })

    it('pasta de backups vazia recusa qualquer coisa', () => {
      mkdirSync(backupsDir, { recursive: true })
      expect(() =>
        resolverBackupRestauravel(dbPath, backupsDir, join(backupsDir, 'tally-x.db'))
      ).toThrow()
    })
  })

  it('escolhe entre várias cópias sem confundir', () => {
    const a = backupDatabase(dbPath, { backupsDir, now: new Date('2026-08-01T10:00:00Z') })!
    const b = backupDatabase(dbPath, { backupsDir, now: new Date('2026-08-02T10:00:00Z') })!

    expect(resolverBackupRestauravel(dbPath, backupsDir, a)).toBe(a)
    expect(resolverBackupRestauravel(dbPath, backupsDir, b)).toBe(b)
  })
})

describe('validarPastaDeBackups', () => {
  it('aceita caminho absoluto', () => {
    expect(() => validarPastaDeBackups(join(tmpdir(), 'destino'))).not.toThrow()
  })

  it('recusa caminho relativo — resolveria contra um cwd imprevisível no app empacotado', () => {
    expect(() => validarPastaDeBackups('backups')).toThrow(/absoluto/i)
    expect(() => validarPastaDeBackups('./backups')).toThrow(/absoluto/i)
    expect(() => validarPastaDeBackups('../fora')).toThrow(/absoluto/i)
  })

  it('recusa string vazia ou só espaço', () => {
    expect(() => validarPastaDeBackups('')).toThrow()
    expect(() => validarPastaDeBackups('   ')).toThrow()
  })
})

describe('retenção não apaga a cópia que está sendo restaurada', () => {
  let dir: string
  let dbPath: string
  let backupsDir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tally-retencao-'))
    dbPath = join(dir, 'tally.db')
    writeFileSync(dbPath, 'banco original')
    backupsDir = join(dir, 'backups')
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('sem `preservar`, o backup de segurança apaga a mais antiga', () => {
    // Documenta o defeito que motivou a opcao: a restauracao faz um backup de
    // seguranca ANTES de sobrescrever, e a retencao dele levava junto a copia
    // escolhida — `copyFileSync` seguinte falhava com ENOENT.
    const maisAntiga = backupDatabase(dbPath, {
      backupsDir,
      maxBackups: 2,
      now: new Date('2026-08-01T10:00:00Z')
    })!
    backupDatabase(dbPath, { backupsDir, maxBackups: 2, now: new Date('2026-08-02T10:00:00Z') })

    backupDatabase(dbPath, { backupsDir, maxBackups: 2, now: new Date('2026-08-03T10:00:00Z') })

    expect(existsSync(maisAntiga)).toBe(false)
  })

  it('com `preservar`, ela sobrevive ao backup de segurança', () => {
    const maisAntiga = backupDatabase(dbPath, {
      backupsDir,
      maxBackups: 2,
      now: new Date('2026-08-01T10:00:00Z')
    })!
    backupDatabase(dbPath, { backupsDir, maxBackups: 2, now: new Date('2026-08-02T10:00:00Z') })

    backupDatabase(dbPath, {
      backupsDir,
      maxBackups: 2,
      now: new Date('2026-08-03T10:00:00Z'),
      preservar: maisAntiga
    })

    expect(existsSync(maisAntiga)).toBe(true)
    // E continua restauravel, que e o ponto todo.
    expect(resolverBackupRestauravel(dbPath, backupsDir, maisAntiga)).toBe(maisAntiga)
  })

  it('guardar a preservada é temporário — o próximo backup reequilibra', () => {
    const maisAntiga = backupDatabase(dbPath, {
      backupsDir,
      maxBackups: 2,
      now: new Date('2026-08-01T10:00:00Z')
    })!
    backupDatabase(dbPath, { backupsDir, maxBackups: 2, now: new Date('2026-08-02T10:00:00Z') })
    backupDatabase(dbPath, {
      backupsDir,
      maxBackups: 2,
      now: new Date('2026-08-03T10:00:00Z'),
      preservar: maisAntiga
    })
    expect(listarBackups(dbPath, backupsDir)).toHaveLength(3)

    backupDatabase(dbPath, { backupsDir, maxBackups: 2, now: new Date('2026-08-04T10:00:00Z') })

    expect(listarBackups(dbPath, backupsDir)).toHaveLength(2)
    expect(existsSync(maisAntiga)).toBe(false)
  })
})
