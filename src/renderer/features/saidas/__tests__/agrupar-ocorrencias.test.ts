import { describe, it, expect } from 'vitest'
import type { OcorrenciaDoMes } from '@shared/ipc/despesa'
import { agruparOcorrencias } from '../agrupar-ocorrencias'

let proximoId = 1

function ocorrencia(overrides: Partial<OcorrenciaDoMes> = {}): OcorrenciaDoMes {
  const id = proximoId++
  return {
    parcelaId: id,
    despesaId: id,
    descricao: 'Compra',
    categoriaId: 1,
    cartaoId: 1,
    formaPagamento: 'Credito',
    tipo: 'Unica',
    dataCompra: '2026-08-14',
    dataReferencia: '2026-08-01',
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

const NOMES: Record<number, string> = { 1: 'Nubank', 2: 'Inter' }
const nomeCartao = (id: number) => NOMES[id] ?? `#${id}`

describe('agruparOcorrencias', () => {
  it('cria uma seção por cartão, nomeada pelo cartão', () => {
    const grupos = agruparOcorrencias(
      [ocorrencia({ cartaoId: 1 }), ocorrencia({ cartaoId: 2 })],
      nomeCartao
    )

    expect(grupos.map((g) => g.rotulo)).toEqual(['Nubank', 'Inter'])
  })

  it('junta ocorrências do mesmo cartão e soma o impacto', () => {
    const grupos = agruparOcorrencias(
      [
        ocorrencia({ cartaoId: 1, impactoCentavos: 41658 }),
        ocorrencia({ cartaoId: 1, impactoCentavos: 4490 })
      ],
      nomeCartao
    )

    expect(grupos).toHaveLength(1)
    expect(grupos[0]?.itens).toHaveLength(2)
    expect(grupos[0]?.totalCentavos).toBe(46148)
  })

  // O subtotal soma IMPACTO, nunca o valor de origem — é o que faz o número
  // bater com o total da fatura na tela de Faturas.
  it('soma o impacto do mês, não o valor cheio da compra', () => {
    const grupos = agruparOcorrencias(
      [ocorrencia({ cartaoId: 1, impactoCentavos: 41658, origemCentavos: 499900 })],
      nomeCartao
    )

    expect(grupos[0]?.totalCentavos).toBe(41658)
  })

  it('agrupa o que sai da conta sob "Fora do cartão"', () => {
    const grupos = agruparOcorrencias(
      [ocorrencia({ cartaoId: null, formaPagamento: 'Pix' })],
      nomeCartao
    )

    expect(grupos[0]?.rotulo).toBe('Fora do cartão')
    expect(grupos[0]?.cartaoId).toBeNull()
  })

  // Cartão tem prazo de fechamento a acompanhar; o que já saiu da conta, não.
  it('empurra "Fora do cartão" para o fim, mesmo vindo primeiro', () => {
    const grupos = agruparOcorrencias(
      [ocorrencia({ cartaoId: null }), ocorrencia({ cartaoId: 1 })],
      nomeCartao
    )

    expect(grupos.map((g) => g.rotulo)).toEqual(['Nubank', 'Fora do cartão'])
  })

  it('preserva a ordem de aparição entre cartões', () => {
    const grupos = agruparOcorrencias(
      [ocorrencia({ cartaoId: 2 }), ocorrencia({ cartaoId: 1 }), ocorrencia({ cartaoId: 2 })],
      nomeCartao
    )

    expect(grupos.map((g) => g.rotulo)).toEqual(['Inter', 'Nubank'])
    expect(grupos[0]?.itens).toHaveLength(2)
  })

  it('cai para o id quando o cartão não é conhecido', () => {
    const grupos = agruparOcorrencias([ocorrencia({ cartaoId: 99 })], nomeCartao)

    expect(grupos[0]?.rotulo).toBe('#99')
  })

  it('devolve lista vazia sem ocorrências', () => {
    expect(agruparOcorrencias([], nomeCartao)).toEqual([])
  })

  it('não muta o array de entrada', () => {
    const itens = [ocorrencia({ cartaoId: 1 })]
    agruparOcorrencias(itens, nomeCartao)

    expect(itens).toHaveLength(1)
  })
})
