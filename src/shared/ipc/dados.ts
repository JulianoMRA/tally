import { z } from 'zod'

// Validacao do arquivo de exportacao/importacao. As linhas sao validadas de
// forma estrutural (array de objetos); a integridade por coluna e garantida na
// insercao (o repositorio usa as colunas reais do schema, ignorando chaves
// extras do arquivo) e pelas constraints do proprio SQLite dentro da transacao.
const rowSchema = z.record(z.string(), z.unknown())

export const exportPayloadSchema = z.object({
  formatVersion: z.literal(1),
  exportedAt: z.string(),
  app: z.object({
    name: z.string(),
    schemaVersion: z.string()
  }),
  tables: z.object({
    cartao: z.array(rowSchema),
    categoria: z.array(rowSchema),
    despesa: z.array(rowSchema),
    fatura: z.array(rowSchema),
    parcela: z.array(rowSchema),
    renda: z.array(rowSchema),
    recebimento: z.array(rowSchema)
  })
})

export type ExportPayload = z.infer<typeof exportPayloadSchema>
