import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { IpcMain } from 'electron'
import type { SimulacaoDoMes } from '../../../src/domain/entities/simulacao'
import { SIMULACAO_IPC_CHANNELS, SIMULACAO_VAZIA } from '../../../src/shared/ipc/simulacao'
import { registerSimulacaoHandlers } from '../simulacao-handlers'

type Handler = (evento: unknown, payload: unknown) => unknown

/**
 * `ipcMain` falso: guarda o que foi registrado e deixa o teste invocar o
 * handler direto. É o que torna a camada `electron/` testável sem subir o
 * Electron — mesmo caminho já usado por `manutencao` e `navegacao`.
 */
function ipcMainFalso(): {
  ipcMain: IpcMain
  invocar: (canal: string, payload?: unknown) => unknown
} {
  const handlers = new Map<string, Handler>()
  const ipcMain = {
    handle: (canal: string, handler: Handler) => handlers.set(canal, handler)
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

const MES = '2026-09'

const SIMULACAO: SimulacaoDoMes = {
  base: { modo: 'manual', valorManualCentavos: 20000 },
  itens: [
    {
      id: 'a',
      descricao: 'Fim de semana',
      valorCentavos: 10000,
      repeticoes: 2,
      tipo: 'saida',
      ativo: true
    }
  ]
}

describe('registerSimulacaoHandlers', () => {
  let dir: string
  let caminho: string
  let ponte: ReturnType<typeof ipcMainFalso>

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tally-sim-ipc-'))
    caminho = join(dir, 'simulacoes.json')
    ponte = ipcMainFalso()
    registerSimulacaoHandlers(caminho, ponte.ipcMain)
  })

  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    } catch {
      // best-effort
    }
  })

  it('obter num mes sem nada devolve o estado inicial', () => {
    expect(ponte.invocar(SIMULACAO_IPC_CHANNELS.obter, { mesReferencia: MES })).toEqual(
      SIMULACAO_VAZIA
    )
  })

  it('salvar devolve a simulacao validada e obter le a mesma coisa', () => {
    const salva = ponte.invocar(SIMULACAO_IPC_CHANNELS.salvar, {
      mesReferencia: MES,
      simulacao: SIMULACAO
    })

    expect(salva).toEqual(SIMULACAO)
    expect(ponte.invocar(SIMULACAO_IPC_CHANNELS.obter, { mesReferencia: MES })).toEqual(SIMULACAO)
  })

  it('recusa payload sem mes de referencia', () => {
    expect(() => ponte.invocar(SIMULACAO_IPC_CHANNELS.obter, {})).toThrow()
  })

  it('recusa mes fora do formato YYYY-MM', () => {
    expect(() =>
      ponte.invocar(SIMULACAO_IPC_CHANNELS.obter, { mesReferencia: '09/2026' })
    ).toThrow()
  })

  it('recusa item com valor negativo vindo do renderer', () => {
    expect(() =>
      ponte.invocar(SIMULACAO_IPC_CHANNELS.salvar, {
        mesReferencia: MES,
        simulacao: { ...SIMULACAO, itens: [{ ...SIMULACAO.itens[0], valorCentavos: -1 }] }
      })
    ).toThrow()
  })

  it('recusa campo desconhecido em vez de grava-lo', () => {
    const salva = ponte.invocar(SIMULACAO_IPC_CHANNELS.salvar, {
      mesReferencia: MES,
      simulacao: { ...SIMULACAO, itens: [{ ...SIMULACAO.itens[0], despesaId: 42 }] }
    }) as SimulacaoDoMes

    expect(salva.itens[0]).not.toHaveProperty('despesaId')
  })

  it('registra exatamente os dois canais da simulacao', () => {
    expect(() => ponte.invocar('simulacao:excluir-tudo')).toThrow(/nao registrado/)
  })
})
