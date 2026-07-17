import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { lerConfig, gravarConfig } from '../settings'
import { CONFIG_DEFAULTS } from '../../shared/ipc/config'

describe('settings (config em JSON no userData)', () => {
  let dir: string
  let caminho: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tally-settings-'))
    caminho = join(dir, 'settings.json')
  })

  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    } catch {
      // best-effort
    }
  })

  it('retorna defaults quando o arquivo nao existe', () => {
    expect(lerConfig(caminho)).toEqual(CONFIG_DEFAULTS)
  })

  it('grava e le de volta a mesma configuracao (round-trip)', () => {
    const config = {
      ...CONFIG_DEFAULTS,
      backupAoSair: false,
      retencaoBackups: 25,
      diasAntecedenciaAviso: 7
    }

    gravarConfig(caminho, config)

    expect(lerConfig(caminho)).toEqual(config)
    expect(existsSync(caminho)).toBe(true)
  })

  it('retorna defaults quando o arquivo esta corrompido (JSON invalido)', () => {
    writeFileSync(caminho, '{ backupAoSair: nao-e-json', 'utf8')
    expect(lerConfig(caminho)).toEqual(CONFIG_DEFAULTS)
  })

  it('retorna defaults quando o arquivo tem shape invalido (schema)', () => {
    writeFileSync(caminho, JSON.stringify({ retencaoBackups: 'muitos' }), 'utf8')
    expect(lerConfig(caminho)).toEqual(CONFIG_DEFAULTS)
  })

  it('campos ausentes em arquivo de versao antiga assumem os defaults', () => {
    // Simula settings.json gravado antes de novos campos existirem.
    writeFileSync(caminho, JSON.stringify({ backupAoSair: false }), 'utf8')

    const config = lerConfig(caminho)

    expect(config.backupAoSair).toBe(false)
    expect(config.retencaoBackups).toBe(CONFIG_DEFAULTS.retencaoBackups)
    expect(config.notificacoesAtivas).toBe(CONFIG_DEFAULTS.notificacoesAtivas)
  })

  it('gravarConfig rejeita configuracao invalida sem tocar o arquivo', () => {
    gravarConfig(caminho, CONFIG_DEFAULTS)
    const antes = readFileSync(caminho, 'utf8')

    expect(() => gravarConfig(caminho, { ...CONFIG_DEFAULTS, retencaoBackups: 0 })).toThrow()

    expect(readFileSync(caminho, 'utf8')).toBe(antes)
  })
})
