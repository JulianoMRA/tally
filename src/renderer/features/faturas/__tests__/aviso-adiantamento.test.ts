import { describe, it, expect } from 'vitest'
import { avisoDoAdiantamento } from '../aviso-adiantamento'

/**
 * O aviso repetia a quantidade PEDIDA ("5 parcela(s) adiantada(s)."). O main
 * move só as elegíveis e devolve quais moveu: pedir 5 com 2 elegíveis, ou
 * pedir para uma fatura que não recebe nada, anunciava 5.
 */
describe('avisoDoAdiantamento', () => {
  it('movidas todas as pedidas, diz quantas, no singular e no plural', () => {
    expect(avisoDoAdiantamento(1, 1)).toEqual({ texto: '1 parcela adiantada.', tipo: 'success' })
    expect(avisoDoAdiantamento(3, 3)).toEqual({
      texto: '3 parcelas adiantadas.',
      tipo: 'success'
    })
  })

  it('movidas menos que as pedidas, diz quantas de quantas', () => {
    expect(avisoDoAdiantamento(2, 5)).toEqual({
      texto: '2 de 5 parcelas adiantadas.',
      tipo: 'success'
    })
  })

  it('nenhuma movida, diz que não havia o que adiantar', () => {
    expect(avisoDoAdiantamento(0, 2)).toEqual({
      texto: 'Nenhuma parcela para adiantar para esta fatura.',
      tipo: 'info'
    })
  })
})
