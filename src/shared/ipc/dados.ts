import { z } from 'zod'
import { dataIsoSchema } from './date-schema'

// Validacao do arquivo de exportacao/importacao. Cada tabela tem um schema de
// linha com as colunas do schema atual (tipos, enums, faixas); colunas extras
// passam adiante (looseObject) para tolerar exports de schemas futuros — a
// insercao usa apenas as colunas reais e as constraints do SQLite fecham a
// ultima linha de defesa dentro da transacao.

const idSchema = z.number().int().positive()
const centavosSchema = z.number().int().min(0)
const flag01Schema = z.union([z.literal(0), z.literal(1)])
const diaDoMesSchema = z.number().int().min(1).max(31)
const mesReferenciaSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'mes_referencia deve ser YYYY-MM com mes 01..12')
const timestampSchema = z.string().min(1)

const cartaoRowSchema = z.looseObject({
  id: idSchema,
  nome: z.string().min(1),
  dia_fechamento: diaDoMesSchema,
  dia_vencimento: diaDoMesSchema,
  cor: z.string().min(1),
  ativo: flag01Schema,
  created_at: timestampSchema,
  updated_at: timestampSchema
})

const categoriaRowSchema = z.looseObject({
  id: idSchema,
  nome: z.string().min(1),
  tipo: z.enum(['Despesa', 'Renda', 'Ambos']),
  cor: z.string().min(1),
  ativo: flag01Schema,
  created_at: timestampSchema,
  updated_at: timestampSchema
})

const orcamentoRowSchema = z.looseObject({
  id: idSchema,
  categoria_id: idSchema,
  mes_referencia: mesReferenciaSchema.nullable(),
  valor_limite_centavos: centavosSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema
})

const despesaRowSchema = z.looseObject({
  id: idSchema,
  descricao: z.string().min(1),
  categoria_id: idSchema,
  tipo: z.enum(['Unica', 'Parcelada', 'Assinatura']),
  forma_pagamento: z.enum(['Credito', 'Debito', 'Pix', 'Dinheiro']),
  cartao_id: idSchema.nullable(),
  valor_centavos: centavosSchema,
  total_parcelas: z.number().int().positive().nullable(),
  data_compra: dataIsoSchema,
  nota: z.string().nullable().optional(),
  ativa: flag01Schema,
  created_at: timestampSchema,
  updated_at: timestampSchema
})

const tagRowSchema = z.looseObject({
  id: idSchema,
  nome: z.string().min(1),
  created_at: timestampSchema
})

const despesaTagRowSchema = z.looseObject({
  despesa_id: idSchema,
  tag_id: idSchema
})

const faturaRowSchema = z.looseObject({
  id: idSchema,
  cartao_id: idSchema,
  mes_referencia: mesReferenciaSchema,
  data_fechamento: dataIsoSchema,
  data_vencimento: dataIsoSchema,
  status: z.enum(['Aberta', 'Fechada', 'Paga']),
  data_pagamento: dataIsoSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema
})

const parcelaRowSchema = z.looseObject({
  id: idSchema,
  despesa_id: idSchema,
  fatura_id: idSchema.nullable(),
  numero: z.number().int().positive(),
  total: z.number().int().positive().nullable(),
  valor_centavos: centavosSchema,
  data_referencia: dataIsoSchema,
  status: z.enum(['Pendente', 'Paga']),
  data_pagamento: dataIsoSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema
})

const rendaRowSchema = z.looseObject({
  id: idSchema,
  nome: z.string().min(1),
  tipo: z.enum(['Avulsa', 'Recorrente']),
  valor_padrao_centavos: centavosSchema,
  dia_esperado: diaDoMesSchema.nullable(),
  ativa: flag01Schema,
  created_at: timestampSchema,
  updated_at: timestampSchema
})

const recebimentoRowSchema = z.looseObject({
  id: idSchema,
  renda_id: idSchema.nullable(),
  valor_centavos: centavosSchema,
  data_esperada: dataIsoSchema,
  data_recebida: dataIsoSchema.nullable(),
  status: z.enum(['Esperado', 'Recebido']),
  created_at: timestampSchema,
  updated_at: timestampSchema
})

export const exportPayloadSchema = z.object({
  formatVersion: z.literal(1),
  exportedAt: z.string(),
  app: z.object({
    name: z.string(),
    schemaVersion: z.string()
  }),
  tables: z.object({
    cartao: z.array(cartaoRowSchema),
    categoria: z.array(categoriaRowSchema),
    orcamento: z.array(orcamentoRowSchema),
    despesa: z.array(despesaRowSchema),
    fatura: z.array(faturaRowSchema),
    parcela: z.array(parcelaRowSchema),
    renda: z.array(rendaRowSchema),
    recebimento: z.array(recebimentoRowSchema),
    // Tabelas da fase 11. `default([])` mantém importável um export antigo que
    // não as tinha (formatVersion segue 1).
    tag: z.array(tagRowSchema).default([]),
    despesa_tag: z.array(despesaTagRowSchema).default([])
  })
})

export type ExportPayload = z.infer<typeof exportPayloadSchema>
