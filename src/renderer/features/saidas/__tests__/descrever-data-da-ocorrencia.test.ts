import { describe, it, expect } from 'vitest'
import type { OcorrenciaDoMes } from '@shared/ipc/despesa'
import { descreverDataDaOcorrencia, agruparSeAplicavel } from '../descrever-data-da-ocorrencia'

function ocorrencia(overrides: Partial<OcorrenciaDoMes> = {}): OcorrenciaDoMes {
  return {
    parcelaId: 1,
    despesaId: 1,
    descricao: 'Mercado',
    categoriaId: 1,
    cartaoId: 1,
    formaPagamento: 'Credito',
    tipo: 'Unica',
    dataCompra: '2026-09-12',
    dataReferencia: '2026-09-01',
    statusParcela: 'Pendente',
    ativa: true,
    nota: null,
    tags: [],
    impactoCentavos: 5000,
    origemCentavos: null,
    rotuloParcela: 'à vista',
    progressoPct: null,
    ...overrides
  }
}

describe('descreverDataDaOcorrencia', () => {
  // A coluna se chama "Compra" e não "Data" de propósito: ela diz quando o
  // compromisso NASCEU, não quando o dinheiro sai. Quem responde a segunda
  // pergunta é o agrupamento por cartão e a tela de Faturas.
  it('compra única mostra o dia da compra', () => {
    const d = descreverDataDaOcorrencia(ocorrencia({ dataCompra: '2026-09-12' }))

    expect(d.texto).toBe('12/09/2026')
    expect(d.apoio).toBe(false)
  })

  it('gasto fora do cartão mostra o dia do gasto', () => {
    const d = descreverDataDaOcorrencia(
      ocorrencia({ cartaoId: null, formaPagamento: 'Pix', dataCompra: '2026-09-03' })
    )

    expect(d.texto).toBe('03/09/2026')
  })

  // A F4 tirou a data da tela argumentando que "a parcela 7/12 não aconteceu em
  // dia nenhum do mês exibido". Isso vale para AGRUPAR por dia, não para exibir:
  // saber que a parcela vem de uma compra de sete meses atrás é justamente o
  // contexto que a linha não tinha.
  it('parcela de compra antiga mostra a data da compra original', () => {
    const d = descreverDataDaOcorrencia(
      ocorrencia({ tipo: 'Parcelada', rotuloParcela: '7/12', dataCompra: '2026-02-12' })
    )

    expect(d.texto).toBe('12/02/2026')
    expect(d.apoio).toBe(false)
  })

  // Assinatura não tem "data da compra" no sentido das outras: a data de início
  // pode ser de anos atrás e repeti-la como se fosse um evento do mês mentiria.
  it('assinatura diz desde quando, em tom de apoio', () => {
    const d = descreverDataDaOcorrencia(
      ocorrencia({ tipo: 'Assinatura', rotuloParcela: 'mensal', dataCompra: '2024-03-08' })
    )

    expect(d.texto).toBe('desde 03/2024')
    expect(d.apoio).toBe(true)
  })

  it('não inventa dia quando a data vem vazia', () => {
    const d = descreverDataDaOcorrencia(ocorrencia({ dataCompra: '' }))

    expect(d.texto).toBe('—')
    expect(d.apoio).toBe(true)
  })
})

describe('agruparSeAplicavel', () => {
  // O agrupamento por cartão existe para o subtotal reconciliar com o total da
  // fatura (decisão da F4). Mas ele impede "o mês inteiro em ordem
  // cronológica": ordenar por data só valia DENTRO de cada grupo.
  it('ordenar por compra achata os grupos', () => {
    expect(agruparSeAplicavel('compra')).toBe(false)
  })

  it('as demais ordenações mantêm o agrupamento por cartão', () => {
    expect(agruparSeAplicavel('valor')).toBe(true)
    expect(agruparSeAplicavel('descricao')).toBe(true)
  })

  // Guard da ida e volta: o agrupamento tem que VOLTAR ao sair de "compra",
  // senão o subtotal por cartão vira uma função de mão única.
  it('voltar de compra para valor devolve o agrupamento', () => {
    expect(agruparSeAplicavel('compra')).toBe(false)
    expect(agruparSeAplicavel('valor')).toBe(true)
  })
})
