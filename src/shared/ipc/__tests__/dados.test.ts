import { describe, expect, it } from 'vitest'
import { exportPayloadSchema, type ExportPayload } from '../dados'

function payloadValido(): ExportPayload {
  return {
    formatVersion: 1,
    exportedAt: '2026-06-11T12:00:00.000Z',
    app: { name: 'tally', schemaVersion: '0006_backfill_parcelas_pagas' },
    tables: {
      cartao: [
        {
          id: 1,
          nome: 'Inter',
          dia_fechamento: 5,
          dia_vencimento: 12,
          cor: '#000000',
          ativo: 1,
          created_at: '2026-06-01 10:00:00',
          updated_at: '2026-06-01 10:00:00'
        }
      ],
      categoria: [
        {
          id: 1,
          nome: 'Mercado',
          tipo: 'Despesa',
          cor: '#aaa000',
          ativo: 1,
          created_at: '2026-06-01 10:00:00',
          updated_at: '2026-06-01 10:00:00'
        }
      ],
      orcamento: [
        {
          id: 1,
          categoria_id: 1,
          mes_referencia: null,
          valor_limite_centavos: 50000,
          created_at: '2026-06-01 10:00:00',
          updated_at: '2026-06-01 10:00:00'
        }
      ],
      despesa: [
        {
          id: 1,
          descricao: 'Compra',
          categoria_id: 1,
          tipo: 'Unica',
          forma_pagamento: 'Credito',
          cartao_id: 1,
          valor_centavos: 8000,
          total_parcelas: 1,
          data_compra: '2026-06-03',
          ativa: 1,
          created_at: '2026-06-01 10:00:00',
          updated_at: '2026-06-01 10:00:00'
        }
      ],
      fatura: [
        {
          id: 1,
          cartao_id: 1,
          mes_referencia: '2026-06',
          data_fechamento: '2026-06-05',
          data_vencimento: '2026-06-12',
          status: 'Aberta',
          data_pagamento: null,
          created_at: '2026-06-01 10:00:00',
          updated_at: '2026-06-01 10:00:00'
        }
      ],
      parcela: [
        {
          id: 1,
          despesa_id: 1,
          fatura_id: 1,
          numero: 1,
          total: 1,
          valor_centavos: 8000,
          data_referencia: '2026-06-03',
          status: 'Pendente',
          data_pagamento: null,
          created_at: '2026-06-01 10:00:00',
          updated_at: '2026-06-01 10:00:00'
        }
      ],
      renda: [
        {
          id: 1,
          nome: 'Bolsa',
          tipo: 'Recorrente',
          valor_padrao_centavos: 100000,
          dia_esperado: 5,
          ativa: 1,
          created_at: '2026-06-01 10:00:00',
          updated_at: '2026-06-01 10:00:00'
        }
      ],
      recebimento: [
        {
          id: 1,
          renda_id: 1,
          valor_centavos: 100000,
          data_esperada: '2026-06-05',
          data_recebida: null,
          status: 'Esperado',
          created_at: '2026-06-01 10:00:00',
          updated_at: '2026-06-01 10:00:00'
        }
      ]
    }
  } as ExportPayload
}

describe('exportPayloadSchema — validação por tabela', () => {
  it('aceita um payload completo válido', () => {
    expect(() => exportPayloadSchema.parse(payloadValido())).not.toThrow()
  })

  it('aceita tabelas vazias', () => {
    const p = payloadValido()
    for (const tabela of Object.keys(p.tables)) {
      ;(p.tables as Record<string, unknown[]>)[tabela] = []
    }
    expect(() => exportPayloadSchema.parse(p)).not.toThrow()
  })

  it('preserva colunas extras desconhecidas (compatibilidade com schemas futuros)', () => {
    const p = payloadValido()
    ;(p.tables.cartao[0] as Record<string, unknown>).coluna_futura = 'x'
    const parsed = exportPayloadSchema.parse(p)
    expect((parsed.tables.cartao[0] as Record<string, unknown>).coluna_futura).toBe('x')
  })

  it('rejeita mes_referencia de calendário impossível na fatura (2026-19)', () => {
    const p = payloadValido()
    ;(p.tables.fatura[0] as Record<string, unknown>).mes_referencia = '2026-19'
    expect(() => exportPayloadSchema.parse(p)).toThrow()
  })

  it('rejeita mes_referencia 2026-00 na fatura', () => {
    const p = payloadValido()
    ;(p.tables.fatura[0] as Record<string, unknown>).mes_referencia = '2026-00'
    expect(() => exportPayloadSchema.parse(p)).toThrow()
  })

  it('rejeita valor_centavos negativo na despesa', () => {
    const p = payloadValido()
    ;(p.tables.despesa[0] as Record<string, unknown>).valor_centavos = -100
    expect(() => exportPayloadSchema.parse(p)).toThrow()
  })

  it('rejeita valor_centavos não inteiro na parcela', () => {
    const p = payloadValido()
    ;(p.tables.parcela[0] as Record<string, unknown>).valor_centavos = 10.5
    expect(() => exportPayloadSchema.parse(p)).toThrow()
  })

  it('rejeita status desconhecido na parcela', () => {
    const p = payloadValido()
    ;(p.tables.parcela[0] as Record<string, unknown>).status = 'Cancelada'
    expect(() => exportPayloadSchema.parse(p)).toThrow()
  })

  it('rejeita data de calendário impossível (2026-02-30) no recebimento', () => {
    const p = payloadValido()
    ;(p.tables.recebimento[0] as Record<string, unknown>).data_esperada = '2026-02-30'
    expect(() => exportPayloadSchema.parse(p)).toThrow()
  })

  it('rejeita forma_pagamento desconhecida na despesa', () => {
    const p = payloadValido()
    ;(p.tables.despesa[0] as Record<string, unknown>).forma_pagamento = 'Cheque'
    expect(() => exportPayloadSchema.parse(p)).toThrow()
  })

  it('rejeita dia_esperado fora de 1..31 na renda', () => {
    const p = payloadValido()
    ;(p.tables.renda[0] as Record<string, unknown>).dia_esperado = 32
    expect(() => exportPayloadSchema.parse(p)).toThrow()
  })
})
