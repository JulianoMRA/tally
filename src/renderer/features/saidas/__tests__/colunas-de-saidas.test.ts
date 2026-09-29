import { describe, it, expect } from 'vitest'
import { cartao, ocorrencia } from '../../../__tests__/__fixtures__/builders'
import { colunasDoAgrupamento, origemDaOcorrencia } from '../colunas-de-saidas'

describe('colunasDoAgrupamento', () => {
  it('por origem, a tabela de sempre: a origem já está no cabeçalho da seção', () => {
    expect(colunasDoAgrupamento('origem')).toEqual([
      'descricao',
      'categoria',
      'compra',
      'parcela',
      'valor',
      'acoes'
    ])
  })

  // A coluna que a seção torna repetida sai; a informação que a seção deixa de
  // mostrar entra. Agrupada por categoria, sem a coluna Origem a lista não diria
  // de que cartão é cada linha.
  it('por categoria, troca a coluna Categoria pela Origem', () => {
    expect(colunasDoAgrupamento('categoria')).toEqual([
      'descricao',
      'origem',
      'compra',
      'parcela',
      'valor',
      'acoes'
    ])
  })

  // Sem seção nenhuma, as duas informações precisam de coluna. Antes a lista
  // sem agrupamento não mostrava o cartão em lugar nenhum.
  it('sem agrupamento, mostra Categoria e Origem', () => {
    expect(colunasDoAgrupamento('nenhum')).toEqual([
      'descricao',
      'categoria',
      'origem',
      'compra',
      'parcela',
      'valor',
      'acoes'
    ])
  })
})

describe('origemDaOcorrencia', () => {
  const inter = cartao({ id: 2, nome: 'Inter', cor: '#a88454' })
  const cartaoPorId = new Map([[inter.id, inter]])

  it('no crédito, o cartão com a cor dele', () => {
    expect(origemDaOcorrencia(ocorrencia({ cartaoId: 2 }), cartaoPorId)).toEqual({
      texto: 'Inter',
      cor: '#a88454'
    })
  })

  // Sem cartão, a forma diz mais que "Fora do cartão": é o que diferencia o
  // aluguel no Pix da feira em dinheiro.
  it('sem cartão, a forma de pagamento, sem cor', () => {
    const semCartao = { cartaoId: null, faturaId: null }
    expect(
      origemDaOcorrencia(ocorrencia({ ...semCartao, formaPagamento: 'Pix' }), cartaoPorId)
    ).toEqual({ texto: 'Pix' })
    expect(
      origemDaOcorrencia(ocorrencia({ ...semCartao, formaPagamento: 'Debito' }), cartaoPorId)
    ).toEqual({ texto: 'Débito' })
    expect(
      origemDaOcorrencia(ocorrencia({ ...semCartao, formaPagamento: 'Dinheiro' }), cartaoPorId)
    ).toEqual({ texto: 'Dinheiro' })
  })

  it('cai para o id quando o cartão não é conhecido', () => {
    expect(origemDaOcorrencia(ocorrencia({ cartaoId: 9 }), cartaoPorId)).toEqual({ texto: '#9' })
  })
})
