import { describe, it, expect } from 'vitest'
import { resumoDoPainel } from '../resumo-do-painel'

describe('resumoDoPainel', () => {
  it('sem filtro, conta o mês inteiro', () => {
    expect(resumoDoPainel(79, 79, 396596)).toEqual({
      contagem: '79 lançamentos',
      totalCentavos: 396596
    })
  })

  it('usa o singular com um lançamento só', () => {
    expect(resumoDoPainel(1, 1, 500)?.contagem).toBe('1 lançamento')
  })

  // A contagem da aba "Todas" repetia o número do painel e nenhum dos dois
  // dizia se a lista estava inteira: com filtro, o painel diz quanto ficou de
  // fora.
  it('com filtro, diz quantos de quantos', () => {
    expect(resumoDoPainel(12, 79, 84500)?.contagem).toBe('12 de 79 lançamentos')
  })

  it('com o filtro escondendo tudo, mostra zero do total', () => {
    expect(resumoDoPainel(0, 79, 0)?.contagem).toBe('0 de 79 lançamentos')
  })

  // O estado vazio já diz que o mês não tem lançamento: "0 lançamentos · R$ 0,00"
  // ao lado dele só repetiria.
  it('não resume um mês vazio', () => {
    expect(resumoDoPainel(0, 0, 0)).toBeNull()
  })
})
