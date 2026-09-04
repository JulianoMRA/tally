import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ItemSimulacao, SimulacaoDoMes } from '../../domain/entities/simulacao'
import { MAX_ITENS_SIMULACAO, SIMULACAO_VAZIA } from '../../shared/ipc/simulacao'
import { lerSimulacoes, obterSimulacaoDoMes, salvarSimulacaoDoMes } from '../simulacoes'

const MES = '2026-09'

function item(parcial: Partial<ItemSimulacao> = {}): ItemSimulacao {
  return {
    id: 'i1',
    descricao: 'Fim de semana',
    valorCentavos: 10000,
    repeticoes: 4,
    tipo: 'saida',
    ativo: true,
    ...parcial
  }
}

function simulacao(parcial: Partial<SimulacaoDoMes> = {}): SimulacaoDoMes {
  return { base: { modo: 'mes', valorManualCentavos: 0 }, itens: [item()], ...parcial }
}

describe('simulacoes (rascunho em JSON no userData)', () => {
  let dir: string
  let caminho: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tally-simulacoes-'))
    caminho = join(dir, 'simulacoes.json')
  })

  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    } catch {
      // best-effort
    }
  })

  it('arquivo ausente devolve o estado inicial, sem criar arquivo', () => {
    expect(obterSimulacaoDoMes(caminho, MES)).toEqual(SIMULACAO_VAZIA)
    expect(existsSync(caminho)).toBe(false)
  })

  it('grava e le de volta a mesma simulacao (round-trip)', () => {
    const s = simulacao()

    salvarSimulacaoDoMes(caminho, MES, s)

    expect(obterSimulacaoDoMes(caminho, MES)).toEqual(s)
  })

  it('cada mes tem a sua lista: gravar setembro nao mexe em outubro', () => {
    salvarSimulacaoDoMes(caminho, '2026-09', simulacao())
    salvarSimulacaoDoMes(
      caminho,
      '2026-10',
      simulacao({ itens: [item({ id: 'z', valorCentavos: 500 })] })
    )

    expect(obterSimulacaoDoMes(caminho, '2026-09').itens[0].valorCentavos).toBe(10000)
    expect(obterSimulacaoDoMes(caminho, '2026-10').itens[0].valorCentavos).toBe(500)
  })

  it('JSON corrompido devolve vazio em vez de derrubar o app', () => {
    writeFileSync(caminho, '{ isto nao e json', 'utf8')

    expect(lerSimulacoes(caminho)).toEqual({ meses: {} })
    expect(obterSimulacaoDoMes(caminho, MES)).toEqual(SIMULACAO_VAZIA)
  })

  it('arquivo com shape errado devolve vazio', () => {
    writeFileSync(caminho, JSON.stringify({ meses: 'nao e objeto' }), 'utf8')

    expect(lerSimulacoes(caminho)).toEqual({ meses: {} })
  })

  it('mes corrompido e descartado sozinho: os outros sobrevivem', () => {
    // O motivo de a simulacao ter arquivo proprio, aplicado tambem aqui dentro:
    // validar em bloco faria uma linha ruim de setembro apagar outubro junto.
    salvarSimulacaoDoMes(caminho, '2026-10', simulacao())
    const arquivo = JSON.parse(readFileSync(caminho, 'utf8'))
    arquivo.meses['2026-09'] = { base: { modo: 'mes' }, itens: [{ descricao: 'sem valor' }] }
    writeFileSync(caminho, JSON.stringify(arquivo), 'utf8')

    const lido = lerSimulacoes(caminho)

    expect(Object.keys(lido.meses)).toEqual(['2026-10'])
    expect(obterSimulacaoDoMes(caminho, '2026-09')).toEqual(SIMULACAO_VAZIA)
  })

  it('chave que nao e mes de referencia e ignorada', () => {
    writeFileSync(
      caminho,
      JSON.stringify({ meses: { '2026-13': simulacao(), setembro: simulacao() } }),
      'utf8'
    )

    expect(lerSimulacoes(caminho)).toEqual({ meses: {} })
  })

  it('recusa item com valor negativo sem tocar o arquivo', () => {
    salvarSimulacaoDoMes(caminho, MES, simulacao())
    const antes = readFileSync(caminho, 'utf8')

    expect(() =>
      salvarSimulacaoDoMes(caminho, MES, simulacao({ itens: [item({ valorCentavos: -1 })] }))
    ).toThrow()
    expect(readFileSync(caminho, 'utf8')).toBe(antes)
  })

  it('recusa lista acima do teto de itens do mes', () => {
    const itens = Array.from({ length: MAX_ITENS_SIMULACAO + 1 }, (_, i) => item({ id: `i${i}` }))

    expect(() => salvarSimulacaoDoMes(caminho, MES, simulacao({ itens }))).toThrow()
  })

  it('aceita exatamente o teto de itens', () => {
    const itens = Array.from({ length: MAX_ITENS_SIMULACAO }, (_, i) => item({ id: `i${i}` }))

    salvarSimulacaoDoMes(caminho, MES, simulacao({ itens }))

    expect(obterSimulacaoDoMes(caminho, MES).itens).toHaveLength(MAX_ITENS_SIMULACAO)
  })

  it('recusa mes de referencia invalido', () => {
    expect(() => salvarSimulacaoDoMes(caminho, '2026-13', simulacao())).toThrow(/Mês/)
  })

  it('mes de volta ao estado inicial sai do arquivo', () => {
    salvarSimulacaoDoMes(caminho, MES, simulacao())

    salvarSimulacaoDoMes(caminho, MES, { base: { modo: 'mes', valorManualCentavos: 0 }, itens: [] })

    expect(lerSimulacoes(caminho).meses[MES]).toBeUndefined()
  })

  it('base manual sem itens continua gravada: e escolha, nao lista vazia', () => {
    salvarSimulacaoDoMes(caminho, MES, {
      base: { modo: 'manual', valorManualCentavos: 20000 },
      itens: []
    })

    expect(obterSimulacaoDoMes(caminho, MES).base).toEqual({
      modo: 'manual',
      valorManualCentavos: 20000
    })
  })

  it('o estado inicial devolvido e uma copia: mexer nele nao contamina o proximo mes', () => {
    const primeiro = obterSimulacaoDoMes(caminho, MES)
    primeiro.itens.push(item())
    primeiro.base.modo = 'manual'

    expect(obterSimulacaoDoMes(caminho, '2026-10')).toEqual(SIMULACAO_VAZIA)
    expect(SIMULACAO_VAZIA.itens).toHaveLength(0)
    expect(SIMULACAO_VAZIA.base.modo).toBe('mes')
  })
})
