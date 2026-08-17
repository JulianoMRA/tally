import { describe, it, expect } from 'vitest'
import {
  descreverOcorrencia,
  type DespesaDaOcorrencia,
  type ParcelaDaOcorrencia
} from '../descrever-ocorrencia'

function despesa(overrides: Partial<DespesaDaOcorrencia> = {}): DespesaDaOcorrencia {
  return {
    tipo: 'Parcelada',
    valorCentavos: 499900,
    totalParcelas: 12,
    ...overrides
  }
}

function parcela(overrides: Partial<ParcelaDaOcorrencia> = {}): ParcelaDaOcorrencia {
  return {
    numero: 7,
    total: 12,
    valorCentavos: 41658,
    dataReferencia: '2026-08-01',
    status: 'Pendente',
    ...overrides
  }
}

describe('descreverOcorrencia — impacto do mês', () => {
  // O impacto vem SEMPRE da parcela, nunca de uma divisão do valor da despesa:
  // `distribuirCentavos` joga o resto na última parcela, e em parcelada em
  // andamento o valor da despesa é o restante, não a compra.
  it('usa o valor da parcela como impacto, não o valor da despesa', () => {
    const o = descreverOcorrencia(
      despesa({ valorCentavos: 499900 }),
      parcela({ valorCentavos: 41658 }),
      1
    )

    expect(o.impactoCentavos).toBe(41658)
  })

  it('respeita a parcela com o resto dos centavos', () => {
    // R$ 100,00 em 3x → 33,33 / 33,33 / 33,34.
    const o = descreverOcorrencia(
      despesa({ valorCentavos: 10000, totalParcelas: 3 }),
      parcela({ numero: 3, total: 3, valorCentavos: 3334 }),
      1
    )

    expect(o.impactoCentavos).toBe(3334)
  })

  it('para gasto único o impacto é o próprio valor', () => {
    const o = descreverOcorrencia(
      despesa({ tipo: 'Unica', valorCentavos: 15000, totalParcelas: 1 }),
      parcela({ numero: 1, total: 1, valorCentavos: 15000 }),
      1
    )

    expect(o.impactoCentavos).toBe(15000)
  })

  it('para assinatura o impacto é a mensalidade', () => {
    const o = descreverOcorrencia(
      despesa({ tipo: 'Assinatura', valorCentavos: 4490, totalParcelas: null }),
      parcela({ numero: 3, total: null, valorCentavos: 4490 }),
      1
    )

    expect(o.impactoCentavos).toBe(4490)
  })
})

describe('descreverOcorrencia — valor de origem', () => {
  it('parcelada iniciada do zero mostra o valor cheio da compra', () => {
    const o = descreverOcorrencia(despesa({ valorCentavos: 499900 }), parcela(), 1)

    expect(o.origemCentavos).toBe(499900)
  })

  // Em "parcelada em andamento" a despesa guarda o valor RESTANTE, e o app não
  // registra o preço original em lugar nenhum. Exibi-lo como "de R$ X" seria
  // apresentar o saldo devedor como preço de compra.
  it('parcelada em andamento não inventa um valor de compra', () => {
    const o = descreverOcorrencia(despesa({ valorCentavos: 300000 }), parcela({ numero: 8 }), 7)

    expect(o.origemCentavos).toBeNull()
  })

  it('gasto único não tem valor de origem — seria repetir o impacto', () => {
    const o = descreverOcorrencia(
      despesa({ tipo: 'Unica', valorCentavos: 15000, totalParcelas: 1 }),
      parcela({ numero: 1, total: 1, valorCentavos: 15000 }),
      1
    )

    expect(o.origemCentavos).toBeNull()
  })

  it('assinatura não tem valor de origem — não existe compra fechada', () => {
    const o = descreverOcorrencia(
      despesa({ tipo: 'Assinatura', valorCentavos: 4490, totalParcelas: null }),
      parcela({ total: null, valorCentavos: 4490 }),
      1
    )

    expect(o.origemCentavos).toBeNull()
  })
})

describe('descreverOcorrencia — rótulo da parcela', () => {
  it('parcelada mostra X/Y', () => {
    const o = descreverOcorrencia(despesa(), parcela({ numero: 7, total: 12 }), 1)

    expect(o.rotuloParcela).toBe('7/12')
  })

  it('parcelada em andamento preserva a numeração original', () => {
    const o = descreverOcorrencia(despesa(), parcela({ numero: 9, total: 12 }), 7)

    expect(o.rotuloParcela).toBe('9/12')
  })

  it('assinatura é mensal, não numerada', () => {
    const o = descreverOcorrencia(
      despesa({ tipo: 'Assinatura', totalParcelas: null }),
      parcela({ total: null }),
      1
    )

    expect(o.rotuloParcela).toBe('mensal')
  })

  it('gasto único é à vista', () => {
    const o = descreverOcorrencia(
      despesa({ tipo: 'Unica', totalParcelas: 1 }),
      parcela({ numero: 1, total: 1 }),
      1
    )

    expect(o.rotuloParcela).toBe('à vista')
  })

  // Parcelada sem `total` na parcela não deveria existir, mas a coluna é
  // nullable no schema: melhor degradar para o número solto do que renderizar
  // "7/null".
  it('parcelada sem total na parcela cai para o número solto', () => {
    const o = descreverOcorrencia(despesa(), parcela({ numero: 7, total: null }), 1)

    expect(o.rotuloParcela).toBe('7')
  })
})

describe('descreverOcorrencia — progresso', () => {
  it('calcula a fração concluída de uma parcelada', () => {
    const o = descreverOcorrencia(despesa(), parcela({ numero: 6, total: 12 }), 1)

    expect(o.progressoPct).toBe(50)
  })

  it('última parcela fecha em 100%', () => {
    const o = descreverOcorrencia(despesa(), parcela({ numero: 12, total: 12 }), 1)

    expect(o.progressoPct).toBe(100)
  })

  it('sem total não há progresso a mostrar', () => {
    const o = descreverOcorrencia(
      despesa({ tipo: 'Assinatura', totalParcelas: null }),
      parcela({ total: null }),
      1
    )

    expect(o.progressoPct).toBeNull()
  })
})
