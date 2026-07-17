import { parseValorBrl } from '@shared/csv/valor-brl'
import {
  linhaImportacaoSchema,
  type LinhaImportacao,
  type TipoImportacao
} from '@shared/ipc/importacao'

// Templates fixos do Tally: um CSV por tipo, delimitador ';', datas
// YYYY-MM-DD, valores no formato 1.234,56. O modelo baixavel traz o header e
// uma linha de exemplo.

export type TemplateImportacao = {
  id: TipoImportacao
  rotulo: string
  arquivo: string
  colunas: readonly string[]
  exemplo: readonly string[]
  converter: (campos: string[]) => LinhaImportacao
}

function parseInteiro(texto: string, coluna: string): number {
  const n = Number(texto.trim())
  if (!Number.isInteger(n)) {
    throw new Error(`${coluna} deve ser um número inteiro, recebido '${texto}'`)
  }
  return n
}

export const TEMPLATES: readonly TemplateImportacao[] = [
  {
    id: 'gastoForaCartao',
    rotulo: 'Gastos fora de cartão (Pix, débito, dinheiro)',
    arquivo: 'tally-gastos.csv',
    colunas: ['descricao', 'categoria', 'forma_pagamento', 'valor', 'data'],
    exemplo: ['Almoço no centro', 'Alimentação', 'Pix', '25,90', '2026-07-10'],
    converter: ([descricao, categoria, forma, valor, data]) =>
      linhaImportacaoSchema.parse({
        tipo: 'gastoForaCartao',
        descricao,
        categoriaNome: categoria,
        formaPagamento: forma,
        valorCentavos: parseValorBrl(valor),
        data
      })
  },
  {
    id: 'unicaCredito',
    rotulo: 'Compras únicas no cartão de crédito',
    arquivo: 'tally-compras-credito.csv',
    colunas: ['descricao', 'categoria', 'cartao', 'valor', 'data'],
    exemplo: ['Supermercado', 'Alimentação', 'Inter', '180,00', '2026-07-02'],
    converter: ([descricao, categoria, cartao, valor, data]) =>
      linhaImportacaoSchema.parse({
        tipo: 'unicaCredito',
        descricao,
        categoriaNome: categoria,
        cartaoNome: cartao,
        valorCentavos: parseValorBrl(valor),
        data
      })
  },
  {
    id: 'parceladaEmAndamento',
    rotulo: 'Parceladas (novas ou em andamento)',
    arquivo: 'tally-parceladas.csv',
    colunas: [
      'descricao',
      'categoria',
      'cartao',
      'total_parcelas',
      'parcela_atual',
      'valor_parcela',
      'data_compra'
    ],
    exemplo: ['Notebook', 'Eletrônicos', 'Inter', '12', '7', '250,00', '2026-01-15'],
    converter: ([descricao, categoria, cartao, total, atual, valorParcela, data]) => {
      const totalParcelas = parseInteiro(total, 'total_parcelas')
      const parcelaAtual = parseInteiro(atual, 'parcela_atual')
      const restantes = totalParcelas - parcelaAtual + 1
      return linhaImportacaoSchema.parse({
        tipo: 'parceladaEmAndamento',
        descricao,
        categoriaNome: categoria,
        cartaoNome: cartao,
        totalParcelas,
        parcelaAtual,
        valorRestanteCentavos: parseValorBrl(valorParcela) * Math.max(restantes, 1),
        dataCompra: data
      })
    }
  },
  {
    id: 'assinatura',
    rotulo: 'Assinaturas (streaming, mensalidades)',
    arquivo: 'tally-assinaturas.csv',
    colunas: ['descricao', 'categoria', 'cartao', 'valor_mensal', 'data_inicio'],
    exemplo: ['Streaming de vídeo', 'Lazer', 'Nubank', '39,90', '2026-07-01'],
    converter: ([descricao, categoria, cartao, valorMensal, dataInicio]) =>
      linhaImportacaoSchema.parse({
        tipo: 'assinatura',
        descricao,
        categoriaNome: categoria,
        cartaoNome: cartao,
        valorMensalCentavos: parseValorBrl(valorMensal),
        dataInicio
      })
  },
  {
    id: 'rendaRecorrente',
    rotulo: 'Rendas recorrentes (bolsa, salário)',
    arquivo: 'tally-rendas.csv',
    colunas: ['nome', 'valor', 'dia_esperado', 'data_inicio'],
    exemplo: ['Bolsa PET', '1.200,00', '5', '2026-07-01'],
    converter: ([nome, valor, dia, dataInicio]) =>
      linhaImportacaoSchema.parse({
        tipo: 'rendaRecorrente',
        nome,
        valorCentavos: parseValorBrl(valor),
        diaEsperado: parseInteiro(dia, 'dia_esperado'),
        dataInicio
      })
  },
  {
    id: 'recebimentoAvulso',
    rotulo: 'Recebimentos avulsos (freela, presente)',
    arquivo: 'tally-recebimentos.csv',
    colunas: ['nome', 'valor', 'data_esperada', 'data_recebida'],
    exemplo: ['Freela site', '500,00', '2026-07-15', ''],
    converter: ([nome, valor, dataEsperada, dataRecebida]) =>
      linhaImportacaoSchema.parse({
        tipo: 'recebimentoAvulso',
        nome,
        valorCentavos: parseValorBrl(valor),
        dataEsperada,
        dataRecebida: dataRecebida.trim() === '' ? null : dataRecebida
      })
  }
]

export function validarHeader(template: TemplateImportacao, header: string[]): void {
  const normalizado = header.map((h) => h.trim().toLowerCase())
  const esperado = template.colunas.map((c) => c.toLowerCase())
  if (normalizado.length !== esperado.length || esperado.some((col, i) => normalizado[i] !== col)) {
    throw new Error(
      `Cabeçalho não corresponde ao template '${template.arquivo}'. Esperado: ${template.colunas.join(
        ';'
      )}`
    )
  }
}

export type ErroDeLinha = { linha: number; motivo: string }
export type ResultadoConversao = { validas: LinhaImportacao[]; erros: ErroDeLinha[] }

/** Converte as linhas cruas do CSV; erros carregam o número da linha no arquivo. */
export function converterLinhas(
  template: TemplateImportacao,
  linhas: string[][]
): ResultadoConversao {
  const validas: LinhaImportacao[] = []
  const erros: ErroDeLinha[] = []
  linhas.forEach((campos, i) => {
    try {
      validas.push(template.converter(campos))
    } catch (err) {
      erros.push({ linha: i + 2, motivo: resumirErro(err) })
    }
  })
  return { validas, erros }
}

function resumirErro(err: unknown): string {
  if (err && typeof err === 'object' && 'issues' in err) {
    const issues = (err as { issues: { path: (string | number)[]; message: string }[] }).issues
    return issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
  }
  return err instanceof Error ? err.message : String(err)
}

/** Conteúdo do modelo baixável (header + linha de exemplo, delimitador ';'). */
export function conteudoDoModelo(template: TemplateImportacao): string {
  return `${template.colunas.join(';')}\n${template.exemplo.join(';')}\n`
}
