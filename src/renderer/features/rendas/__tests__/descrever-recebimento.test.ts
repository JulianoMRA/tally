import { describe, it, expect } from 'vitest'
import type { RecebimentoComContexto } from '@shared/ipc/recebimento'
import {
  descreverRecebimento,
  montarProgressoDoMes,
  mediaDeEntradas
} from '../descrever-recebimento'

const HOJE = '2026-08-15'

let proximoId = 1

function recebimento(overrides: Partial<RecebimentoComContexto> = {}): RecebimentoComContexto {
  const id = proximoId++
  return {
    id,
    rendaId: 1,
    rendaNome: 'Bolsa PET',
    valorCentavos: 70000,
    dataEsperada: '2026-08-05',
    dataRecebida: null,
    status: 'Esperado',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides
  }
}

describe('descreverRecebimento — status sem repetir a data', () => {
  // Ponto 15: hoje a linha mostra "esperada 05/08" numa coluna e
  // "Recebido 05/08/2026" na outra, dizendo quase a mesma coisa duas vezes.
  it('recebido vira uma frase só, com a data em que caiu', () => {
    const d = descreverRecebimento(
      recebimento({ status: 'Recebido', dataRecebida: '2026-08-05' }),
      HOJE
    )

    expect(d.frase).toBe('na conta em 05/08')
    expect(d.realizado).toBe(true)
  })

  it('previsto para o futuro diz quanto falta', () => {
    const d = descreverRecebimento(recebimento({ dataEsperada: '2026-08-25' }), HOJE)

    expect(d.frase).toBe('previsto para 25/08 · em 10 dias')
    expect(d.realizado).toBe(false)
  })

  it('previsto para amanhã não usa plural', () => {
    const d = descreverRecebimento(recebimento({ dataEsperada: '2026-08-16' }), HOJE)

    expect(d.frase).toBe('previsto para 16/08 · em 1 dia')
  })

  it('previsto para hoje é hoje, não "em 0 dias"', () => {
    const d = descreverRecebimento(recebimento({ dataEsperada: '2026-08-15' }), HOJE)

    expect(d.frase).toBe('previsto para hoje')
  })

  // Entrada que não caiu na data é o caso que precisa de atenção — a frase tem
  // que denunciar, não dizer "previsto" como se ainda estivesse no prazo.
  it('previsto com data já passada avisa o atraso', () => {
    const d = descreverRecebimento(recebimento({ dataEsperada: '2026-08-10' }), HOJE)

    expect(d.frase).toBe('previsto para 10/08 · atrasado 5 dias')
    expect(d.atrasado).toBe(true)
  })

  it('atraso de um dia não usa plural', () => {
    const d = descreverRecebimento(recebimento({ dataEsperada: '2026-08-14' }), HOJE)

    expect(d.frase).toBe('previsto para 14/08 · atrasado 1 dia')
  })

  it('recebido nunca é atrasado, mesmo caindo depois do esperado', () => {
    const d = descreverRecebimento(
      recebimento({ status: 'Recebido', dataEsperada: '2026-08-01', dataRecebida: '2026-08-12' }),
      HOJE
    )

    expect(d.frase).toBe('na conta em 12/08')
    expect(d.atrasado).toBe(false)
  })

  // A coluna dataRecebida é nullable no schema; sem ela não dá para afirmar
  // um dia, mas o dinheiro está lá.
  it('recebido sem data registrada não inventa dia', () => {
    const d = descreverRecebimento(recebimento({ status: 'Recebido', dataRecebida: null }), HOJE)

    expect(d.frase).toBe('na conta')
    expect(d.realizado).toBe(true)
  })
})

describe('montarProgressoDoMes', () => {
  it('separa o que já caiu do que ainda falta', () => {
    const p = montarProgressoDoMes([
      recebimento({ status: 'Recebido', valorCentavos: 140000, dataRecebida: '2026-08-05' }),
      recebimento({ status: 'Esperado', valorCentavos: 70000 })
    ])

    expect(p.recebidoCentavos).toBe(140000)
    expect(p.previstoCentavos).toBe(70000)
    expect(p.totalCentavos).toBe(210000)
  })

  it('calcula a fatia já recebida para a barra', () => {
    const p = montarProgressoDoMes([
      recebimento({ status: 'Recebido', valorCentavos: 140000, dataRecebida: '2026-08-05' }),
      recebimento({ status: 'Esperado', valorCentavos: 60000 })
    ])

    expect(p.recebidoPct).toBe(70)
  })

  it('conta quantas entradas ainda faltam, para a nota da barra', () => {
    const p = montarProgressoDoMes([
      recebimento({ status: 'Recebido', dataRecebida: '2026-08-05' }),
      recebimento({ status: 'Esperado' }),
      recebimento({ status: 'Esperado' })
    ])

    expect(p.entradasPendentes).toBe(2)
  })

  it('mês inteiramente recebido fecha em 100% sem pendências', () => {
    const p = montarProgressoDoMes([
      recebimento({ status: 'Recebido', dataRecebida: '2026-08-05' })
    ])

    expect(p.recebidoPct).toBe(100)
    expect(p.entradasPendentes).toBe(0)
    expect(p.previstoCentavos).toBe(0)
  })

  it('mês sem nada recebido fica em 0%, não em NaN', () => {
    const p = montarProgressoDoMes([recebimento({ status: 'Esperado' })])

    expect(p.recebidoPct).toBe(0)
  })

  it('lista vazia não divide por zero', () => {
    const p = montarProgressoDoMes([])

    expect(p.recebidoPct).toBe(0)
    expect(p.totalCentavos).toBe(0)
    expect(p.entradasPendentes).toBe(0)
  })
})

describe('mediaDeEntradas', () => {
  // R$ 2.100 não significa nada sozinho; comparado à média vira informação.
  it('calcula a média das entradas dos meses recebidos', () => {
    const media = mediaDeEntradas([
      { mes: '2026-06', entradasCentavos: 200000, saidasCentavos: 0, saldoCentavos: 0 },
      { mes: '2026-07', entradasCentavos: 190000, saidasCentavos: 0, saldoCentavos: 0 }
    ])

    expect(media).toBe(195000)
  })

  // O mês corrente ainda está em curso: incluí-lo puxaria a média para baixo e
  // faria a comparação sempre parecer favorável.
  it('ignora o mês corrente quando ele é informado', () => {
    const media = mediaDeEntradas(
      [
        { mes: '2026-06', entradasCentavos: 200000, saidasCentavos: 0, saldoCentavos: 0 },
        { mes: '2026-07', entradasCentavos: 190000, saidasCentavos: 0, saldoCentavos: 0 },
        { mes: '2026-08', entradasCentavos: 10000, saidasCentavos: 0, saldoCentavos: 0 }
      ],
      '2026-08'
    )

    expect(media).toBe(195000)
  })

  it('arredonda para centavo inteiro', () => {
    const media = mediaDeEntradas([
      { mes: '2026-06', entradasCentavos: 10000, saidasCentavos: 0, saldoCentavos: 0 },
      { mes: '2026-07', entradasCentavos: 10001, saidasCentavos: 0, saldoCentavos: 0 },
      { mes: '2026-05', entradasCentavos: 10001, saidasCentavos: 0, saldoCentavos: 0 }
    ])

    expect(Number.isInteger(media)).toBe(true)
  })

  it('sem histórico devolve null, para a tela omitir a comparação', () => {
    expect(mediaDeEntradas([])).toBeNull()
    expect(
      mediaDeEntradas(
        [{ mes: '2026-08', entradasCentavos: 1, saidasCentavos: 0, saldoCentavos: 0 }],
        '2026-08'
      )
    ).toBeNull()
  })
})
