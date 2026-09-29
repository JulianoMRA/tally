import type { Cartao } from '@domain/entities/cartao'
import type { Categoria } from '@domain/entities/categoria'
import type { OcorrenciaDoMes } from '@shared/ipc/despesa'

/**
 * Construtores de dado para os testes do renderer.
 *
 * Cada um devolve um registro válido e completo, e o teste sobrescreve só o
 * campo que importa para o caso — o resto do objeto é ruído que esconderia a
 * intenção. Ids vêm de um contador, para duas chamadas nunca colidirem.
 */

let proximoId = 1000

function novoId(): number {
  return proximoId++
}

export function categoria(overrides: Partial<Categoria> = {}): Categoria {
  const id = overrides.id ?? novoId()
  return {
    id,
    nome: `Categoria ${id}`,
    cor: '#5b7a5e',
    ativo: true,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...overrides
  }
}

export function cartao(overrides: Partial<Cartao> = {}): Cartao {
  const id = overrides.id ?? novoId()
  return {
    id,
    nome: `Cartão ${id}`,
    diaFechamento: 25,
    diaVencimento: 5,
    cor: '#a88454',
    ativo: true,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...overrides
  }
}

/** Compra à vista no crédito, na fatura de junho/2026. */
export function ocorrencia(overrides: Partial<OcorrenciaDoMes> = {}): OcorrenciaDoMes {
  const id = novoId()
  return {
    parcelaId: id,
    despesaId: id,
    descricao: `Compra ${id}`,
    categoriaId: 1,
    cartaoId: 1,
    formaPagamento: 'Credito',
    tipo: 'Unica',
    dataCompra: '2026-06-03',
    dataReferencia: '2026-06-01',
    faturaId: 1,
    statusParcela: 'Pendente',
    ativa: true,
    nota: null,
    tags: [],
    impactoCentavos: 10000,
    origemCentavos: null,
    rotuloParcela: 'à vista',
    progressoPct: null,
    ...overrides
  }
}
