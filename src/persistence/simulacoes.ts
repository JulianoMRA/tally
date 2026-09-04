import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import type { SimulacaoDoMes } from '../domain/entities/simulacao'
import { simulacaoDoMesSchema, SIMULACAO_VAZIA } from '../shared/ipc/simulacao'

/**
 * Armazenamento da simulação (RF-SIM-06), num `simulacoes.json` no `userData`.
 *
 * **Arquivo próprio, e não o `settings.json`, de propósito.** O
 * `configArquivoSchema` invalida o arquivo inteiro quando um campo tem tipo
 * errado e cai nos defaults — uma simulação corrompida levaria junto o tema, a
 * pasta de backups e a retenção. Separado, o estrago fica contido.
 *
 * Fora do SQLite pelo mesmo motivo: é rascunho de hipótese, não dado
 * financeiro. Não consome migration e não entra no export/import de dados.
 */

export type ArquivoSimulacoes = { meses: Record<string, SimulacaoDoMes> }

const MES_REFERENCIA = /^\d{4}-(0[1-9]|1[0-2])$/

function copiaVazia(): SimulacaoDoMes {
  return { base: { ...SIMULACAO_VAZIA.base }, itens: [] }
}

/**
 * Lê o arquivo inteiro. Ausente, ilegível, JSON inválido ou shape inválido
 * devolvem vazio — simulação quebrada nunca impede o app de abrir.
 *
 * **A validação é mês a mês, não do arquivo todo.** Um mês corrompido é
 * descartado sozinho; os outros sobrevivem. Validar em bloco faria uma linha
 * ruim de setembro apagar a simulação de outubro junto.
 */
export function lerSimulacoes(caminho: string): ArquivoSimulacoes {
  if (!existsSync(caminho)) return { meses: {} }

  let bruto: unknown
  try {
    bruto = JSON.parse(readFileSync(caminho, 'utf8'))
  } catch {
    return { meses: {} }
  }

  if (typeof bruto !== 'object' || bruto === null) return { meses: {} }
  const meses = (bruto as { meses?: unknown }).meses
  if (typeof meses !== 'object' || meses === null) return { meses: {} }

  const validos: Record<string, SimulacaoDoMes> = {}
  for (const [mes, simulacao] of Object.entries(meses as Record<string, unknown>)) {
    if (!MES_REFERENCIA.test(mes)) continue
    const parsed = simulacaoDoMesSchema.safeParse(simulacao)
    if (parsed.success) validos[mes] = parsed.data
  }

  return { meses: validos }
}

/** Simulação de um mês; mês sem nada gravado devolve o estado inicial. */
export function obterSimulacaoDoMes(caminho: string, mesReferencia: string): SimulacaoDoMes {
  return lerSimulacoes(caminho).meses[mesReferencia] ?? copiaVazia()
}

/**
 * Mês de volta ao estado inicial não é gravado — sai do arquivo. Sem isso,
 * cada mês visitado deixaria uma entrada morta para sempre.
 */
function ehEstadoInicial(simulacao: SimulacaoDoMes): boolean {
  return (
    simulacao.itens.length === 0 &&
    simulacao.base.modo === SIMULACAO_VAZIA.base.modo &&
    simulacao.base.valorManualCentavos === SIMULACAO_VAZIA.base.valorManualCentavos
  )
}

/** Valida e grava a simulação de um mês. Simulação inválida lança sem tocar o arquivo. */
export function salvarSimulacaoDoMes(
  caminho: string,
  mesReferencia: string,
  simulacao: SimulacaoDoMes
): SimulacaoDoMes {
  if (!MES_REFERENCIA.test(mesReferencia)) {
    throw new Error(`Mês de referência inválido: '${mesReferencia}'.`)
  }

  const valida = simulacaoDoMesSchema.parse(simulacao)
  const arquivo = lerSimulacoes(caminho)

  if (ehEstadoInicial(valida)) {
    delete arquivo.meses[mesReferencia]
  } else {
    arquivo.meses[mesReferencia] = valida
  }

  mkdirSync(dirname(caminho), { recursive: true })
  writeFileSync(caminho, JSON.stringify(arquivo, null, 2), 'utf8')
  return valida
}
