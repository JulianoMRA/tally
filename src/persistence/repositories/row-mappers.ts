/**
 * Row-mappers centralizados — fim do drift entre repositórios.
 *
 * Toda conversão `<tabela>_row` → entidade de domínio vive aqui. Repositórios
 * e handlers IPC importam destes tipos/funções em vez de redeclará-los.
 *
 * Convenções:
 *   * INTEGER 0/1 ↔ boolean
 *   * snake_case (SQLite) ↔ camelCase (domínio)
 *   * status string ↔ discriminated union (Fatura)
 *   * NULL ↔ null (nunca undefined em campos persistidos)
 */
import type { Cartao } from '../../domain/entities/cartao'
import type { Categoria, TipoCategoria } from '../../domain/entities/categoria'
import type { Despesa, FormaPagamento, TipoDespesa } from '../../domain/entities/despesa'
import type { Fatura, StatusFatura } from '../../domain/entities/fatura'
import type { Orcamento } from '../../domain/entities/orcamento'
import type { Parcela, StatusParcela } from '../../domain/entities/parcela'
import type { Recebimento, StatusRecebimento } from '../../domain/entities/recebimento'
import type { Renda, TipoRenda } from '../../domain/entities/renda'
import type { Tag } from '../../domain/entities/tag'

// ────── Cartao ───────────────────────────────────────────────────

export type CartaoRow = {
  id: number
  nome: string
  dia_fechamento: number
  dia_vencimento: number
  cor: string
  ativo: 0 | 1
  created_at: string
  updated_at: string
}

export function mapCartao(row: CartaoRow): Cartao {
  return {
    id: row.id,
    nome: row.nome,
    diaFechamento: row.dia_fechamento,
    diaVencimento: row.dia_vencimento,
    cor: row.cor,
    ativo: row.ativo === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ────── Categoria ────────────────────────────────────────────────

export type CategoriaRow = {
  id: number
  nome: string
  tipo: TipoCategoria
  cor: string
  ativo: 0 | 1
  created_at: string
  updated_at: string
}

export function mapCategoria(row: CategoriaRow): Categoria {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    cor: row.cor,
    ativo: row.ativo === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ────── Despesa ──────────────────────────────────────────────────

export type DespesaRow = {
  id: number
  descricao: string
  categoria_id: number
  tipo: TipoDespesa
  forma_pagamento: FormaPagamento
  cartao_id: number | null
  valor_centavos: number
  total_parcelas: number | null
  data_compra: string
  dia_cobranca: number | null
  recorre_ate: string | null
  nota: string | null
  ativa: 0 | 1
  created_at: string
  updated_at: string
}

export function mapDespesa(row: DespesaRow): Despesa {
  return {
    id: row.id,
    descricao: row.descricao,
    categoriaId: row.categoria_id,
    tipo: row.tipo,
    formaPagamento: row.forma_pagamento,
    cartaoId: row.cartao_id,
    valorCentavos: row.valor_centavos,
    totalParcelas: row.total_parcelas,
    dataCompra: row.data_compra,
    diaCobranca: row.dia_cobranca ?? null,
    recorreAte: row.recorre_ate ?? null,
    nota: row.nota ?? null,
    ativa: row.ativa === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ────── Fatura ───────────────────────────────────────────────────

export type FaturaRow = {
  id: number
  cartao_id: number
  mes_referencia: string
  data_fechamento: string
  data_vencimento: string
  status: 'Aberta' | 'Fechada' | 'Paga'
  data_pagamento: string | null
  created_at: string
  updated_at: string
}

export function mapFatura(row: FaturaRow): Fatura {
  let status: StatusFatura
  switch (row.status) {
    case 'Aberta':
      status = { kind: 'Aberta' }
      break
    case 'Fechada':
      status = { kind: 'Fechada' }
      break
    case 'Paga':
      if (!row.data_pagamento) {
        throw new Error(`Fatura #${row.id} marcada como Paga sem data_pagamento`)
      }
      status = { kind: 'Paga', pagaEm: row.data_pagamento }
      break
  }
  return {
    id: row.id,
    cartaoId: row.cartao_id,
    mesReferencia: row.mes_referencia,
    dataFechamento: row.data_fechamento,
    dataVencimento: row.data_vencimento,
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ────── Parcela ──────────────────────────────────────────────────

export type ParcelaRow = {
  id: number
  despesa_id: number
  fatura_id: number | null
  numero: number
  total: number | null
  valor_centavos: number
  data_referencia: string
  status: StatusParcela
  data_pagamento: string | null
  created_at: string
  updated_at: string
}

export function mapParcela(row: ParcelaRow): Parcela {
  return {
    id: row.id,
    despesaId: row.despesa_id,
    faturaId: row.fatura_id,
    numero: row.numero,
    total: row.total,
    valorCentavos: row.valor_centavos,
    dataReferencia: row.data_referencia,
    status: row.status,
    dataPagamento: row.data_pagamento,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ────── Renda ────────────────────────────────────────────────────

export type RendaRow = {
  id: number
  nome: string
  tipo: TipoRenda
  valor_padrao_centavos: number
  dia_esperado: number | null
  ativa: 0 | 1
  created_at: string
  updated_at: string
}

export function mapRenda(row: RendaRow): Renda {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    valorPadraoCentavos: row.valor_padrao_centavos,
    diaEsperado: row.dia_esperado,
    ativa: row.ativa === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ────── Recebimento ──────────────────────────────────────────────

export type RecebimentoRow = {
  id: number
  renda_id: number | null
  descricao: string | null
  valor_centavos: number
  data_esperada: string
  data_recebida: string | null
  status: StatusRecebimento
  created_at: string
  updated_at: string
}

export function mapRecebimento(row: RecebimentoRow): Recebimento {
  return {
    id: row.id,
    rendaId: row.renda_id,
    descricao: row.descricao,
    valorCentavos: row.valor_centavos,
    dataEsperada: row.data_esperada,
    dataRecebida: row.data_recebida,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ────── Orcamento ────────────────────────────────────────────────

export type OrcamentoRow = {
  id: number
  categoria_id: number
  mes_referencia: string | null
  valor_limite_centavos: number
  created_at: string
  updated_at: string
}

export function mapOrcamento(row: OrcamentoRow): Orcamento {
  return {
    id: row.id,
    categoriaId: row.categoria_id,
    mesReferencia: row.mes_referencia,
    valorLimiteCentavos: row.valor_limite_centavos,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ────── Tag ──────────────────────────────────────────────────────

export type TagRow = {
  id: number
  nome: string
  created_at: string
}

export function mapTag(row: TagRow): Tag {
  return {
    id: row.id,
    nome: row.nome,
    createdAt: row.created_at
  }
}
