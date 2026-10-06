import { z } from 'zod'
import type { Despesa, FormaPagamento, TipoDespesa } from '../../domain/entities/despesa'
import type { Fatura, StatusFatura } from '../../domain/entities/fatura'
import type { Parcela, StatusParcela } from '../../domain/entities/parcela'
import type { MotivoBloqueioExclusao } from '../../domain/services/regras-despesa'
import { dataIsoSchema } from './date-schema'

/**
 * Teto da descrição de uma despesa, no cadastro e na edição. Os modais de edição
 * cortavam em 80 enquanto o cadastro aceitava 120, e a descrição longa perdia o
 * fim ao ser editada.
 */
export const MAX_DESCRICAO_DESPESA = 120

const MENSAGEM_DESCRICAO_LONGA = `Descrição deve ter no máximo ${MAX_DESCRICAO_DESPESA} caracteres`

export const despesaUnicaCreditoInputSchema = z.object({
  descricao: z
    .string()
    .trim()
    .min(1, 'Descrição é obrigatória')
    .max(MAX_DESCRICAO_DESPESA, MENSAGEM_DESCRICAO_LONGA),
  categoriaId: z
    .number({ message: 'Categoria é obrigatória' })
    .int()
    .positive('Categoria inválida'),
  cartaoId: z.number({ message: 'Cartão é obrigatório' }).int().positive('Cartão inválido'),
  valorCentavos: z
    .number({ message: 'Valor é obrigatório' })
    .int()
    .min(1, 'Valor deve ser maior que zero'),
  dataCompra: dataIsoSchema
})

export type DespesaUnicaCreditoInput = z.infer<typeof despesaUnicaCreditoInputSchema>

export const despesaUnicaForaCartaoInputSchema = z.object({
  descricao: z
    .string()
    .trim()
    .min(1, 'Descrição é obrigatória')
    .max(MAX_DESCRICAO_DESPESA, MENSAGEM_DESCRICAO_LONGA),
  categoriaId: z
    .number({ message: 'Categoria é obrigatória' })
    .int()
    .positive('Categoria inválida'),
  formaPagamento: z.enum(['Debito', 'Pix', 'Dinheiro'], {
    message: 'Forma de pagamento inválida'
  }),
  valorCentavos: z
    .number({ message: 'Valor é obrigatório' })
    .int()
    .min(1, 'Valor deve ser maior que zero'),
  dataCompra: dataIsoSchema
})

export type DespesaUnicaForaCartaoInput = z.infer<typeof despesaUnicaForaCartaoInputSchema>

export const listarGastosForaCartaoInputSchema = z.object({
  mesReferencia: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês deve estar no formato YYYY-MM')
    .optional()
})

export type ListarGastosForaCartaoInput = z.infer<typeof listarGastosForaCartaoInputSchema>

export type ResultadoCriarDespesa = {
  despesa: Despesa
  fatura: Fatura
  parcela: Parcela
}

export const despesaParceladaCreditoInputSchema = z.object({
  descricao: z
    .string()
    .trim()
    .min(1, 'Descrição é obrigatória')
    .max(MAX_DESCRICAO_DESPESA, MENSAGEM_DESCRICAO_LONGA),
  categoriaId: z
    .number({ message: 'Categoria é obrigatória' })
    .int()
    .positive('Categoria inválida'),
  cartaoId: z.number({ message: 'Cartão é obrigatório' }).int().positive('Cartão inválido'),
  totalParcelas: z
    .number({ message: 'Total de parcelas é obrigatório' })
    .int()
    .min(2, 'Mínimo 2 parcelas')
    .max(360, 'Máximo 360 parcelas'),
  valorTotalCentavos: z
    .number({ message: 'Valor é obrigatório' })
    .int()
    .min(1, 'Valor deve ser maior que zero'),
  dataCompra: dataIsoSchema
})

export type DespesaParceladaCreditoInput = z.infer<typeof despesaParceladaCreditoInputSchema>

// Objeto base sem refine: pode ser estendido com .omit/.extend pelo renderer.
// Zod não permite .omit() em ZodEffects (resultado de .refine).
export const despesaEmAndamentoInputBaseSchema = despesaParceladaCreditoInputSchema
  .omit({ valorTotalCentavos: true })
  .extend({
    parcelaAtual: z.number().int().min(1, 'Parcela atual deve ser >= 1'),
    valorRestanteCentavos: z
      .number({ message: 'Valor restante é obrigatório' })
      .int()
      .min(1, 'Valor deve ser maior que zero')
  })

export const parcelaAtualNaoExcedeTotal = {
  predicate: (d: { parcelaAtual: number; totalParcelas: number }): boolean =>
    d.parcelaAtual <= d.totalParcelas,
  params: {
    message: 'Parcela atual não pode ser maior que total de parcelas',
    path: ['parcelaAtual'] as PropertyKey[]
  }
}

export const despesaEmAndamentoInputSchema = despesaEmAndamentoInputBaseSchema.refine(
  parcelaAtualNaoExcedeTotal.predicate,
  parcelaAtualNaoExcedeTotal.params
)

export type DespesaEmAndamentoInput = z.infer<typeof despesaEmAndamentoInputSchema>

export const despesaAssinaturaCreditoInputSchema = z.object({
  descricao: z
    .string()
    .trim()
    .min(1, 'Descrição é obrigatória')
    .max(MAX_DESCRICAO_DESPESA, MENSAGEM_DESCRICAO_LONGA),
  categoriaId: z
    .number({ message: 'Categoria é obrigatória' })
    .int()
    .positive('Categoria inválida'),
  cartaoId: z.number({ message: 'Cartão é obrigatório' }).int().positive('Cartão inválido'),
  valorMensalCentavos: z
    .number({ message: 'Valor mensal é obrigatório' })
    .int()
    .min(1, 'Valor deve ser maior que zero'),
  dataInicio: dataIsoSchema
})

export type DespesaAssinaturaCreditoInput = z.infer<typeof despesaAssinaturaCreditoInputSchema>

/**
 * RF-DES-16 — recorrente FORA de cartao. Sem `cartaoId` e sem `dataInicio`:
 * uma recorrente sem cartao nao tem data de compra, tem um mes em que comeca e
 * um dia em que acontece.
 */
export const despesaAssinaturaForaCartaoInputSchema = z.object({
  descricao: z
    .string()
    .trim()
    .min(1, 'Descrição é obrigatória')
    .max(MAX_DESCRICAO_DESPESA, MENSAGEM_DESCRICAO_LONGA),
  categoriaId: z
    .number({ message: 'Categoria é obrigatória' })
    .int()
    .positive('Categoria inválida'),
  formaPagamento: z.enum(['Debito', 'Pix', 'Dinheiro'], {
    message: 'Forma de pagamento inválida'
  }),
  valorMensalCentavos: z
    .number({ message: 'Valor mensal é obrigatório' })
    .int()
    .min(1, 'Valor deve ser maior que zero'),
  mesInicial: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês deve estar no formato YYYY-MM'),
  diaCobranca: z
    .number({ message: 'Dia da cobrança é obrigatório' })
    .int()
    .min(1, 'Dia deve estar entre 1 e 31')
    .max(31, 'Dia deve estar entre 1 e 31'),
  recorreAte: dataIsoSchema.nullable()
})

export type DespesaAssinaturaForaCartaoInput = z.infer<
  typeof despesaAssinaturaForaCartaoInputSchema
>

/** RF-DES-19 — altera a data limite; `null` volta a recorrencia para "sempre". */
export const atualizarLimiteRecorrenciaInputSchema = z.object({
  despesaId: z.number().int().positive(),
  recorreAte: dataIsoSchema.nullable()
})

export type AtualizarLimiteRecorrenciaInput = z.infer<typeof atualizarLimiteRecorrenciaInputSchema>

export const cancelarAssinaturaInputSchema = z.object({
  despesaId: z.number().int().positive()
})

export type CancelarAssinaturaInput = z.infer<typeof cancelarAssinaturaInputSchema>

export const reajustarAssinaturaInputSchema = z.object({
  despesaId: z.number().int().positive(),
  novoValorCentavos: z.number().int().min(1, 'Valor deve ser maior que zero')
})

export type ReajustarAssinaturaInput = z.infer<typeof reajustarAssinaturaInputSchema>

export const listarAssinaturasInputSchema = z.object({
  ativa: z.boolean().optional()
})

export type ListarAssinaturasInput = z.infer<typeof listarAssinaturasInputSchema>

export const listarDespesasInputSchema = z.object({
  tipo: z.enum(['foraCartao', 'parcelada', 'assinatura']).optional(),
  apenasAtivas: z.boolean().optional(),
  mesReferencia: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês deve estar no formato YYYY-MM')
    .optional()
})

export type ListarDespesasInput = z.infer<typeof listarDespesasInputSchema>

export const adiantarParcelasInputSchema = z.object({
  despesaId: z.number().int().positive(),
  quantidade: z.number().int().min(1, 'Quantidade deve ser >= 1'),
  faturaDestinoId: z.number().int().positive()
})

export type AdiantarParcelasInput = z.infer<typeof adiantarParcelasInputSchema>

export const cancelarPendentesInputSchema = z.object({
  despesaId: z.number().int().positive()
})

export type CancelarPendentesInput = z.infer<typeof cancelarPendentesInputSchema>

export type ResultadoCriarParcelada = {
  despesa: Despesa
  parcelas: Parcela[]
}

export type ResultadoAdiantamento = {
  movidas: Parcela[]
  faturasAfetadas: number[]
}

export type ResultadoCancelamento = {
  canceladas: Parcela[]
}

export type ResultadoCriarAssinatura = {
  despesa: Despesa
  parcelas: Parcela[]
}

export type ResultadoCancelarAssinatura = {
  despesa: Despesa
  canceladas: Parcela[]
}

export type ResultadoReajusteAssinatura = {
  despesa: Despesa
  atualizadas: Parcela[]
}

export type ResultadoCriarUnicaForaCartao = {
  despesa: Despesa
  parcela: Parcela
}

export const excluirDespesaInputSchema = z.object({
  despesaId: z.number().int().positive()
})

export type ExcluirDespesaInput = z.infer<typeof excluirDespesaInputSchema>

export type ResultadoExcluirDespesa = {
  despesaExcluida: number
  parcelasExcluidas: number
}

export const atualizarDespesaInputSchema = z.object({
  despesaId: z.number().int().positive(),
  descricao: z
    .string()
    .trim()
    .min(1, 'Descrição é obrigatória')
    .max(MAX_DESCRICAO_DESPESA, MENSAGEM_DESCRICAO_LONGA),
  categoriaId: z.number().int().positive(),
  valorCentavos: z.number().int().min(1, 'Valor deve ser maior que zero'),
  dataCompra: dataIsoSchema.optional()
})

export type AtualizarDespesaInput = z.infer<typeof atualizarDespesaInputSchema>

export const definirNotaETagsInputSchema = z.object({
  despesaId: z.number().int().positive(),
  nota: z.string().max(2000, 'Nota deve ter no máximo 2000 caracteres').nullable(),
  tags: z.array(z.string().trim().max(40, 'Tag deve ter no máximo 40 caracteres')).max(20)
})

export type DefinirNotaETagsInput = z.infer<typeof definirNotaETagsInputSchema>

/**
 * Nota e tags sem o alvo — o que o formulário de cadastro carrega antes de a
 * despesa existir e, portanto, antes de haver um `despesaId`.
 */
export type NotaETags = Omit<DefinirNotaETagsInput, 'despesaId'>

/**
 * RF-DES-21 — marcar/desmarcar ocorrência sem fatura.
 *
 * `dataPagamento` é obrigatória ao marcar e ausente ao desmarcar: o inverso de
 * pagar é não ter data, e não ter uma data guardada de uma parcela pendente.
 */
export const marcarOcorrenciaPagaInputSchema = z.object({
  parcelaId: z.number().int().positive(),
  dataPagamento: dataIsoSchema
})

export type MarcarOcorrenciaPagaInput = z.infer<typeof marcarOcorrenciaPagaInputSchema>

export const desmarcarOcorrenciaPagaInputSchema = z.object({
  parcelaId: z.number().int().positive()
})

export type DesmarcarOcorrenciaPagaInput = z.infer<typeof desmarcarOcorrenciaPagaInputSchema>

/** Despesa com os nomes das tags vinculadas — usado na lista de Saídas. */
export type DespesaComTags = Despesa & { tags: string[] }

export const listarOcorrenciasInputSchema = z.object({
  mesReferencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês deve estar no formato YYYY-MM')
})

export type ListarOcorrenciasInput = z.infer<typeof listarOcorrenciasInputSchema>

const mesSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês deve estar no formato YYYY-MM')

/**
 * RF-DES-22 — intervalo fechado de meses para a busca.
 *
 * O teto de 120 meses existe pelo mesmo motivo do teto de linhas da importação:
 * o resultado é peneirado em memória no renderer, e uma janela sem limite
 * transformaria um engano de digitação (`0026-01`) numa varredura do banco
 * inteiro. Dez anos é o horizonte que a RNF-04 já promete atender.
 */
export const buscarOcorrenciasInputSchema = z
  .object({
    mesInicio: mesSchema,
    mesFim: mesSchema
  })
  .refine((v) => v.mesInicio <= v.mesFim, {
    message: 'O mês inicial não pode ser posterior ao final',
    path: ['mesInicio']
  })
  .refine((v) => mesesNoIntervalo(v.mesInicio, v.mesFim) <= 120, {
    message: 'O intervalo da busca é de no máximo 120 meses',
    path: ['mesFim']
  })

export type BuscarOcorrenciasInput = z.infer<typeof buscarOcorrenciasInputSchema>

/** Quantidade de meses de um intervalo fechado "YYYY-MM".."YYYY-MM". */
function mesesNoIntervalo(inicio: string, fim: string): number {
  const [aAno, aMes] = inicio.split('-').map(Number)
  const [bAno, bMes] = fim.split('-').map(Number)
  return (bAno - aAno) * 12 + (bMes - aMes) + 1
}

/**
 * RF-DES-14 — uma ocorrência de despesa em um mês.
 *
 * `impactoCentavos` é a única grandeza somável da lista: é o que sai naquele
 * mês, valha a despesa uma parcela de um parcelado, a mensalidade de uma
 * assinatura ou um gasto à vista. `origemCentavos` é contexto secundário e
 * vem null quando não há um valor de compra confiável a mostrar.
 */
export type OcorrenciaDoMes = {
  parcelaId: number
  despesaId: number
  descricao: string
  categoriaId: number
  cartaoId: number | null
  formaPagamento: FormaPagamento
  tipo: TipoDespesa
  dataCompra: string
  dataReferencia: string
  /**
   * `null` quando a ocorrência não pertence a fatura alguma. É o campo que
   * decide quem pode marcá-la como paga (RF-DES-21) — e não `cartaoId`, que
   * hoje coincide por causa do CHECK do schema, mas é inferência.
   */
  faturaId: number | null
  statusParcela: StatusParcela
  ativa: boolean
  nota: string | null
  tags: string[]
  impactoCentavos: number
  origemCentavos: number | null
  rotuloParcela: string
  progressoPct: number | null
  /**
   * Status da fatura da ocorrência; ausente fora de fatura. Trava valor e data da
   * compra à vista cuja fatura já fechou (RF-DES-10), como na tela de Faturas.
   */
  statusFatura?: StatusFatura['kind']
  /**
   * Por que a despesa não pode ser excluída (RF-DES-09); ausente quando pode. A
   * regra olha todas as parcelas da despesa, e o mês só conhece as dele: quem
   * responde é o main. Só a lista do mês traz — a busca não oferece ações de
   * linha, e calcular o bloqueio de um intervalo inteiro seria trabalho perdido.
   */
  motivoBloqueioExclusao?: MotivoBloqueioExclusao
}

export type DespesaApi = {
  criarUnicaCredito: (input: DespesaUnicaCreditoInput) => Promise<ResultadoCriarDespesa>
  criarParceladaCredito: (input: DespesaParceladaCreditoInput) => Promise<ResultadoCriarParcelada>
  criarParceladaEmAndamento: (input: DespesaEmAndamentoInput) => Promise<ResultadoCriarParcelada>
  adiantarParcelas: (input: AdiantarParcelasInput) => Promise<ResultadoAdiantamento>
  cancelarPendentes: (input: CancelarPendentesInput) => Promise<ResultadoCancelamento>
  criarAssinaturaCredito: (
    input: DespesaAssinaturaCreditoInput
  ) => Promise<ResultadoCriarAssinatura>
  criarAssinaturaForaCartao: (
    input: DespesaAssinaturaForaCartaoInput
  ) => Promise<ResultadoCriarAssinatura>
  atualizarLimiteRecorrencia: (input: AtualizarLimiteRecorrenciaInput) => Promise<Despesa>
  cancelarAssinatura: (input: CancelarAssinaturaInput) => Promise<ResultadoCancelarAssinatura>
  reajustarValorMensalAssinatura: (
    input: ReajustarAssinaturaInput
  ) => Promise<ResultadoReajusteAssinatura>
  listarAssinaturas: (input?: ListarAssinaturasInput) => Promise<Despesa[]>
  criarUnicaForaCartao: (
    input: DespesaUnicaForaCartaoInput
  ) => Promise<ResultadoCriarUnicaForaCartao>
  listarGastosForaCartao: (input?: ListarGastosForaCartaoInput) => Promise<Despesa[]>
  listarDespesas: (input?: ListarDespesasInput) => Promise<Despesa[]>
  listarComTags: (input?: ListarDespesasInput) => Promise<DespesaComTags[]>
  listarOcorrenciasDoMes: (input: ListarOcorrenciasInput) => Promise<OcorrenciaDoMes[]>
  listarTags: () => Promise<string[]>
  excluir: (input: ExcluirDespesaInput) => Promise<ResultadoExcluirDespesa>
  atualizar: (input: AtualizarDespesaInput) => Promise<Despesa>
  definirNotaETags: (input: DefinirNotaETagsInput) => Promise<Despesa>
  buscarOcorrencias: (input: BuscarOcorrenciasInput) => Promise<OcorrenciaDoMes[]>
  marcarOcorrenciaPaga: (input: MarcarOcorrenciaPagaInput) => Promise<Parcela>
  desmarcarOcorrenciaPaga: (input: DesmarcarOcorrenciaPagaInput) => Promise<Parcela>
}

export { DESPESA_IPC_CHANNELS } from './channels'
