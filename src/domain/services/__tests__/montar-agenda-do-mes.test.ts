import { describe, it, expect } from 'vitest'
import { montarAgendaDoMes } from '../montar-agenda-do-mes'
import type { FaturaParaAgenda, RecebimentoParaAgenda } from '../montar-agenda-do-mes'

const HOJE = '2026-08-16'

function fatura(overrides: Partial<FaturaParaAgenda> = {}): FaturaParaAgenda {
  return {
    cartaoNome: 'Nubank',
    cartaoCor: '#820ad1',
    restanteCentavos: 128490,
    pagoParcialCentavos: 0,
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
          restanteCentavos: 41235
        })
      ],
      recebimentos: [recebimento({ dataEsperada: '2026-08-25' })],
      hoje: HOJE
    })

    expect(agenda.map((e) => e.data)).toEqual(['2026-08-20', '2026-08-25'])
  })

  // Os outros casos entregam os eventos já em ordem de data: sem ordenar nada,
  // a agenda passaria em todos eles. Aqui a entrada vem embaralhada.
  it('ordena eventos que chegam fora de ordem', () => {
    const agenda = montarAgendaDoMes({
      faturas: [],
      recebimentos: [
        recebimento({ fonte: 'Terceiro', dataEsperada: '2026-08-30' }),
        recebimento({ fonte: 'Primeiro', dataEsperada: '2026-08-18' }),
        recebimento({ fonte: 'Segundo', dataEsperada: '2026-08-25' })
      ],
      hoje: HOJE
    })

    expect(agenda.map((e) => e.data)).toEqual(['2026-08-18', '2026-08-25', '2026-08-30'])
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
      restanteCentavos: 128490,
      temPagamentoParcial: false
    })
    expect(agenda[1]).toMatchObject({
      kind: 'VencimentoFatura',
      data: '2026-09-10',
      restanteCentavos: 128490
    })
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

  // As bordas do recorte, para a fatura: "hoje" ainda é "por vir", ontem não.
  it('fechamento que cai exatamente hoje ainda entra', () => {
    const agenda = montarAgendaDoMes({
      faturas: [fatura({ dataFechamento: HOJE, dataVencimento: '2026-08-23' })],
      recebimentos: [],
      hoje: HOJE
    })

    expect(agenda.map((e) => e.kind)).toEqual(['FechamentoFatura', 'VencimentoFatura'])
  })

  it('vencimento que cai exatamente hoje ainda entra', () => {
    const agenda = montarAgendaDoMes({
      faturas: [
        fatura({
          status: { kind: 'Fechada' },
          dataFechamento: '2026-08-09',
          dataVencimento: HOJE
        })
      ],
      recebimentos: [],
      hoje: HOJE
    })

    expect(agenda).toHaveLength(1)
    expect(agenda[0]).toMatchObject({ kind: 'VencimentoFatura', data: HOJE })
  })

  it('fatura que já venceu não emite nada: a agenda é só o que está por vir', () => {
    const agenda = montarAgendaDoMes({
      faturas: [
        fatura({
          status: { kind: 'Fechada' },
          dataFechamento: '2026-08-03',
          dataVencimento: '2026-08-10'
        })
      ],
      recebimentos: [],
      hoje: HOJE
    })

    expect(agenda).toEqual([])
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
      faturas: [fatura({ restanteCentavos: 0 })],
      recebimentos: [],
      hoje: HOJE
    })

    expect(agenda).toEqual([])
  })
})

/**
 * RN-10 — a agenda é a lista do que ainda vai mexer no saldo, e a fatura mexe
 * pelo que falta pagar. Com o total, a agenda anunciaria uma saída de R$ 800
 * no vencimento de uma fatura que o banco só cobra R$ 600, e a soma dos eventos
 * deixaria de bater com a sobra projetada (RN-08).
 */
describe('montarAgendaDoMes — pagamento parcial (RN-10)', () => {
  it('fechamento e vencimento carregam o que falta pagar', () => {
    const agenda = montarAgendaDoMes({
      faturas: [fatura({ restanteCentavos: 60000, pagoParcialCentavos: 20000 })],
      recebimentos: [],
      hoje: HOJE
    })

    expect(agenda).toHaveLength(2)
    expect(agenda[0]).toMatchObject({ kind: 'FechamentoFatura', restanteCentavos: 60000 })
    expect(agenda[1]).toMatchObject({ kind: 'VencimentoFatura', restanteCentavos: 60000 })
  })

  // O painel diz "acumulados" no fechamento. Com pagamento parcial o número já
  // não é o acumulado da fatura, e o evento precisa avisar quem exibe.
  it('o fechamento avisa quando o valor já vem abatido de pagamento parcial', () => {
    const agenda = montarAgendaDoMes({
      faturas: [fatura({ restanteCentavos: 60000, pagoParcialCentavos: 20000 })],
      recebimentos: [],
      hoje: HOJE
    })

    expect(agenda[0]).toMatchObject({ kind: 'FechamentoFatura', temPagamentoParcial: true })
  })

  it('um centavo pago já conta como pagamento parcial', () => {
    const agenda = montarAgendaDoMes({
      faturas: [fatura({ restanteCentavos: 128489, pagoParcialCentavos: 1 })],
      recebimentos: [],
      hoje: HOJE
    })

    expect(agenda[0]).toMatchObject({ kind: 'FechamentoFatura', temPagamentoParcial: true })
  })

  // Como a fatura zerada: sem nada a pagar, nada vai acontecer com o saldo.
  it('fatura cujos pagamentos cobrem o total não emite nada', () => {
    const agenda = montarAgendaDoMes({
      faturas: [fatura({ restanteCentavos: 0, pagoParcialCentavos: 128490 })],
      recebimentos: [],
      hoje: HOJE
    })

    expect(agenda).toEqual([])
  })

  it('faltando um centavo, a fatura ainda entra na agenda', () => {
    const agenda = montarAgendaDoMes({
      faturas: [fatura({ restanteCentavos: 1, pagoParcialCentavos: 128489 })],
      recebimentos: [],
      hoje: HOJE
    })

    expect(agenda.map((e) => e.kind)).toEqual(['FechamentoFatura', 'VencimentoFatura'])
  })

  it('fatura Fechada com pagamento parcial emite o vencimento pelo restante', () => {
    const agenda = montarAgendaDoMes({
      faturas: [
        fatura({
          status: { kind: 'Fechada' },
          dataFechamento: '2026-08-13',
          dataVencimento: '2026-08-20',
          restanteCentavos: 7000,
          pagoParcialCentavos: 5000
        })
      ],
      recebimentos: [],
      hoje: HOJE
    })

    expect(agenda).toEqual([
      {
        kind: 'VencimentoFatura',
        data: '2026-08-20',
        cartaoNome: 'Nubank',
        cartaoCor: '#820ad1',
        restanteCentavos: 7000
      }
    ])
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
