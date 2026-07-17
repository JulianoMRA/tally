import { z } from 'zod'
import { dataIsoSchema } from './date-schema'
import { DADOS_IPC_CHANNELS } from './channels'

// Linhas de importacao CSV JA CONVERTIDAS (valores em centavos int, datas
// ISO): o renderer parseia/converte para o preview e o main re-valida com o
// mesmo schema (defesa em profundidade). Cartao e categoria viajam por NOME
// e sao resolvidos para id no main (case-insensitive, apenas ativos).

const descricaoSchema = z.string().trim().min(1).max(120)
const nomeRefSchema = z.string().trim().min(1).max(80)
const centavosSchema = z.number().int().min(1)

const gastoForaCartaoSchema = z.object({
  tipo: z.literal('gastoForaCartao'),
  descricao: descricaoSchema,
  categoriaNome: nomeRefSchema,
  formaPagamento: z.enum(['Debito', 'Pix', 'Dinheiro']),
  valorCentavos: centavosSchema,
  data: dataIsoSchema
})

const unicaCreditoSchema = z.object({
  tipo: z.literal('unicaCredito'),
  descricao: descricaoSchema,
  categoriaNome: nomeRefSchema,
  cartaoNome: nomeRefSchema,
  valorCentavos: centavosSchema,
  data: dataIsoSchema
})

const parceladaEmAndamentoSchema = z
  .object({
    tipo: z.literal('parceladaEmAndamento'),
    descricao: descricaoSchema,
    categoriaNome: nomeRefSchema,
    cartaoNome: nomeRefSchema,
    totalParcelas: z.number().int().min(1).max(120),
    parcelaAtual: z.number().int().min(1).max(120),
    valorRestanteCentavos: centavosSchema,
    dataCompra: dataIsoSchema
  })
  .refine((l) => l.parcelaAtual <= l.totalParcelas, {
    message: 'parcelaAtual não pode ser maior que totalParcelas',
    path: ['parcelaAtual']
  })

const assinaturaSchema = z.object({
  tipo: z.literal('assinatura'),
  descricao: descricaoSchema,
  categoriaNome: nomeRefSchema,
  cartaoNome: nomeRefSchema,
  valorMensalCentavos: centavosSchema,
  dataInicio: dataIsoSchema
})

const rendaRecorrenteSchema = z.object({
  tipo: z.literal('rendaRecorrente'),
  nome: nomeRefSchema,
  valorCentavos: centavosSchema,
  diaEsperado: z.number().int().min(1).max(31),
  dataInicio: dataIsoSchema
})

const recebimentoAvulsoSchema = z.object({
  tipo: z.literal('recebimentoAvulso'),
  nome: nomeRefSchema,
  valorCentavos: centavosSchema,
  dataEsperada: dataIsoSchema,
  dataRecebida: dataIsoSchema.nullable()
})

export const linhaImportacaoSchema = z.discriminatedUnion('tipo', [
  gastoForaCartaoSchema,
  unicaCreditoSchema,
  parceladaEmAndamentoSchema,
  assinaturaSchema,
  rendaRecorrenteSchema,
  recebimentoAvulsoSchema
])

export const importarCsvInputSchema = z.object({
  linhas: z.array(linhaImportacaoSchema).min(1, 'Nenhuma linha para importar')
})

export type LinhaImportacao = z.infer<typeof linhaImportacaoSchema>
export type TipoImportacao = LinhaImportacao['tipo']
export type ImportarCsvInput = z.infer<typeof importarCsvInputSchema>

export type ResultadoImportacao = {
  inseridos: number
  porTipo: Partial<Record<TipoImportacao, number>>
}

export type DadosApi = {
  importarCsv: (input: ImportarCsvInput) => Promise<ResultadoImportacao>
}

export { DADOS_IPC_CHANNELS }
