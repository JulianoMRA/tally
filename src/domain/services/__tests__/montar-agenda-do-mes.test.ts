import { describe, it, expect } from 'vitest'
import { montarAgendaDoMes } from '../montar-agenda-do-mes'
import type { FaturaParaAgenda, RecebimentoParaAgenda } from '../montar-agenda-do-mes'

const HOJE = '2026-08-16'

function fatura(overrides: Partial<FaturaParaAgenda> = {}): FaturaParaAgenda {
  return {
    cartaoNome: 'Nubank',
    cartaoCor: '#820ad1',
    totalCentavos: 128490,
    dataFechamento: '2026-09-03',
    dataVencimento: '2026-09-10',
    status: { kind: 'Aberta' },
    ...overrides
  }
}

function recebimento(overrides: Partial<RecebimentoParaAgenda> = {}): RecebimentoParaAgenda {
  return {
    fonte: 'Ajuda família',
    dataEsperada: '2026-08-25',
    valorCentavos: 70000,
    status: 'Esperado',
    ...overrides
  }
}

describe('montarAgendaDoMes — recorte temporal', () => {
  it('inclui evento que cai exatamente hoje', () => {
    const agenda = montarAgendaDoMes({
      faturas: [],
      recebimentos: [recebimento({ dataEsperada: HOJE })],
      hoje: HOJE
    })

    expect(agenda).toHaveLength(1)
    expect(agenda[0]?.data).toBe(HOJE)
  })

  it('descarta evento anterior a hoje', () => {
    const agenda = montarAgendaDoMes({
      faturas: [],
      recebimentos: [recebimento({ dataEsperada: '2026-08-15' })],
      hoje: HOJE
    })

    expect(agenda).toEqual([])
  })

  it('ordena por data ascendente, misturando faturas e recebimentos', () => {
    const agenda = montarAgendaDoMes({
      faturas: [
        fatura({
          cartaoNome: 'Inter',
          status: { kind: 'Fechada' },
          dataFechamento: '2026-08-13',
          dataVencimento: '2026-08-20',
          totalCentavos: 41235
        })
      ],
      recebimentos: [recebimento({ dataEsperada: '2026-08-25' })],
      hoje: HOJE
    })

    expect(agenda.map((e) => e.data)).toEqual(['2026-08-20', '2026-08-25'])
  })

  it('preserva a ordem de entrada quando duas datas empatam', () => {
    const agenda = montarAgendaDoMes({
      faturas: [],
      recebimentos: [
        recebimento({ fonte: 'Primeira', dataEsperada: '2026-08-25' }),
        recebimento({ fonte: 'Segunda', dataEsperada: '2026-08-25' })
      ],
      hoje: HOJE
    })

    expect(agenda).toHaveLength(2)
    expect(agenda[0]).toMatchObject({ kind: 'RecebimentoPrevisto', fonte: 'Primeira' })
    expect(agenda[1]).toMatchObject({ kind: 'RecebimentoPrevisto', fonte: 'Segunda' })
  })
})

describe('montarAgendaDoMes — faturas por status', () => {
  it('fatura Aberta emite fechamento e vencimento, nessa ordem', () => {
    const agenda = montarAgendaDoMes({
      faturas: [fatura({ dataFechamento: '2026-09-03', dataVencimento: '2026-09-10' })],
      recebimentos: [],
      hoje: HOJE
    })

    expect(agenda).toHaveLength(2)
    expect(agenda[0]).toMatchObject({
      kind: 'FechamentoFatura',
      data: '2026-09-03',
      cartaoNome: 'Nubank',
      cartaoCor: '#820ad1',
      totalCentavos: 128490
    })
    expect(agenda[1]).toMatchObject({ kind: 'VencimentoFatura', data: '2026-09-10' })
  })

  it('fatura Aberta que já fechou emite só o vencimento', () => {
    const agenda = montarAgendaDoMes({
      faturas: [fatura({ dataFechamento: '2026-08-03', dataVencimento: '2026-08-20' })],
      recebimentos: [],
      hoje: HOJE
    })

    expect(agenda).toHaveLength(1)
    expect(agenda[0]).toMatchObject({ kind: 'VencimentoFatura', data: '2026-08-20' })
  })

  // Fechada não volta a fechar: mesmo com data_fechamento no futuro (fechamento
  // manual antecipado), o evento de fechamento já aconteceu.
  it('fatura Fechada emite só o vencimento, mesmo com fechamento futuro', () => {
    const agenda = montarAgendaDoMes({
      faturas: [
        fatura({
          status: { kind: 'Fechada' },
          dataFechamento: '2026-09-03',
          dataVencimento: '2026-09-10'
        })
      ],
      recebimentos: [],
      hoje: HOJE
    })

    expect(agenda).toHaveLength(1)
    expect(agenda[0]).toMatchObject({ kind: 'VencimentoFatura', data: '2026-09-10' })
  })

  it('fatura Paga não emite nada — já não impacta o saldo', () => {
    const agenda = montarAgendaDoMes({
      faturas: [fatura({ status: { kind: 'Paga', pagaEm: '2026-08-10' } })],
      recebimentos: [],
      hoje: HOJE
    })

    expect(agenda).toEqual([])
  })

  // O trilho de cartões mostra o C6 zerado; a agenda não, porque "ainda vai
  // acontecer" é sobre o que move o saldo.
  it('fatura sem lançamentos não emite nada', () => {
    const agenda = montarAgendaDoMes({
      faturas: [fatura({ totalCentavos: 0 })],
      recebimentos: [],
      hoje: HOJE
    })

    expect(agenda).toEqual([])
  })
})

describe('montarAgendaDoMes — recebimentos', () => {
  it('recebimento já recebido não entra na agenda', () => {
    const agenda = montarAgendaDoMes({
      faturas: [],
      recebimentos: [recebimento({ status: 'Recebido', dataEsperada: '2026-08-25' })],
      hoje: HOJE
    })

    expect(agenda).toEqual([])
  })

  it('carrega fonte e valor do recebimento previsto', () => {
    const agenda = montarAgendaDoMes({
      faturas: [],
      recebimentos: [recebimento({ fonte: 'Bolsa PET', valorCentavos: 70000 })],
      hoje: HOJE
    })

    expect(agenda[0]).toMatchObject({
      kind: 'RecebimentoPrevisto',
      fonte: 'Bolsa PET',
      valorCentavos: 70000
    })
  })

  it('aceita recebimento avulso sem fonte vinculada', () => {
    const agenda = montarAgendaDoMes({
      faturas: [],
      recebimentos: [recebimento({ fonte: null })],
      hoje: HOJE
    })

    expect(agenda[0]).toMatchObject({ kind: 'RecebimentoPrevisto', fonte: null })
  })
})

describe('montarAgendaDoMes — bordas', () => {
  it('devolve lista vazia sem faturas nem recebimentos', () => {
    expect(montarAgendaDoMes({ faturas: [], recebimentos: [], hoje: HOJE })).toEqual([])
  })

  it('não muta os arrays de entrada', () => {
    const faturas = [fatura()]
    const recebimentos = [recebimento()]
    montarAgendaDoMes({ faturas, recebimentos, hoje: HOJE })

    expect(faturas).toHaveLength(1)
    expect(recebimentos).toHaveLength(1)
  })
})
