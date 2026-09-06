import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { IpcMain } from 'electron'

// `config-handlers` importa `dialog` e `shell` como VALOR, então o módulo
// `electron` precisa existir para o import resolver. Nenhum dos dois é usado
// pelos caminhos exercitados aqui.
vi.mock('electron', () => ({
  dialog: { showOpenDialog: vi.fn() },
  shell: { openPath: vi.fn() }
}))

const { backupDatabase } = await import('../../../src/persistence/backup')
const { CONFIG_IPC_CHANNELS } = await import('../../../src/shared/ipc/config')
const { registerConfigHandlers } = await import('../config-handlers')

type Handler = (evento: unknown, payload: unknown) => unknown

function ipcMainFalso(): {
  ipcMain: IpcMain
  invocar: (canal: string, payload?: unknown) => unknown
} {
  const handlers = new Map<string, Handler>()
  const ipcMain = {
    handle: (canal: string, handler: Handler) => handlers.set(canal, handler),
    on: () => undefined
  } as unknown as IpcMain

  return {
    ipcMain,
    invocar: (canal, payload) => {
      const handler = handlers.get(canal)
      if (!handler) throw new Error(`Canal nao registrado: ${canal}`)
      return handler({}, payload)
    }
  }
}

/**
 * A cópia de segurança que a restauração faz antes de sobrescrever o banco é
 * o único desfazer que existe para a operação — e era feita com a conexão
 * SQLite ainda ABERTA, enquanto `criarBackupAgora`, logo acima no mesmo
 * arquivo, fecha e reabre em volta da cópia justamente para não capturar um
 * journal a meio caminho.
 *
 * O teste observa a ordem por efeito, não por espião: o `fechar` falso marca
 * o arquivo do banco, então o conteúdo que aparece dentro do backup diz se ele
 * foi tirado antes ou depois do fechamento.
 */
describe('restaurarBackup fecha o banco antes de copiar', () => {
  let dir: string
  let dbPath: string
  let backupsDir: string
  let settingsPath: string
  let eventos: string[]

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tally-cfg-'))
    dbPath = join(dir, 'tally.db')
    backupsDir = join(dir, 'backups')
    settingsPath = join(dir, 'settings.json')
    eventos = []
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function montar(): ReturnType<typeof ipcMainFalso> {
    const ponte = ipcMainFalso()
    registerConfigHandlers(settingsPath, ponte.ipcMain, () => undefined, {
      caminhoDoBanco: () => dbPath,
      fechar: () => {
        eventos.push('fechar')
        writeFileSync(dbPath, 'ESTADO-COM-BANCO-FECHADO', 'utf8')
      },
      reabrir: () => {
        eventos.push('reabrir')
      }
    })
    return ponte
  }

  function copiasExistentes(): string[] {
    return readdirSync(backupsDir).map((nome) => readFileSync(join(backupsDir, nome), 'utf8'))
  }

  it('a copia de seguranca reflete o banco ja fechado', () => {
    writeFileSync(dbPath, 'CONTEUDO-ANTIGO', 'utf8')
    const origem = backupDatabase(dbPath, { backupsDir })
    if (!origem) throw new Error('backup de origem nao criado')

    writeFileSync(dbPath, 'ESTADO-COM-BANCO-ABERTO', 'utf8')
    montar().invocar(CONFIG_IPC_CHANNELS.restaurarBackup, { caminho: origem })

    expect(copiasExistentes()).toContain('ESTADO-COM-BANCO-FECHADO')
    expect(copiasExistentes()).not.toContain('ESTADO-COM-BANCO-ABERTO')
  })

  it('restaura o conteudo da copia escolhida e reabre o banco', () => {
    writeFileSync(dbPath, 'CONTEUDO-ANTIGO', 'utf8')
    const origem = backupDatabase(dbPath, { backupsDir })
    if (!origem) throw new Error('backup de origem nao criado')

    writeFileSync(dbPath, 'ESTADO-COM-BANCO-ABERTO', 'utf8')
    montar().invocar(CONFIG_IPC_CHANNELS.restaurarBackup, { caminho: origem })

    expect(readFileSync(dbPath, 'utf8')).toBe('CONTEUDO-ANTIGO')
    expect(eventos).toEqual(['fechar', 'reabrir'])
  })

  it('recusa caminho fora da pasta de backups sem tocar no banco', () => {
    writeFileSync(dbPath, 'INTACTO', 'utf8')
    const intruso = join(dir, 'qualquer.db')
    writeFileSync(intruso, 'MALICIOSO', 'utf8')

    expect(() =>
      montar().invocar(CONFIG_IPC_CHANNELS.restaurarBackup, { caminho: intruso })
    ).toThrow(/Cópia de backup inválida/)
    expect(readFileSync(dbPath, 'utf8')).toBe('INTACTO')
    expect(eventos).toEqual([])
  })
})
