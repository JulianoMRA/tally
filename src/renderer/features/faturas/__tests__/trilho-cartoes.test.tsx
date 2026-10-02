// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import type { Cartao } from '@domain/entities/cartao'
import type { FaturaComTotal } from '@shared/ipc/fatura'
import type { StatusFatura } from '@domain/entities/fatura'
import { mesAtualReferencia } from '@shared/datas-locais'
import { proxMesReferencia } from '@domain/services/mes-referencia'
import { formatarMesReferencia } from '../../../lib/formatar-data'
import { TrilhoCartoes } from '../TrilhoCartoes'
import type { GrupoFaturasCartao } from '../hooks/use-faturas'

const MES_CORRENTE = mesAtualReferencia()
const MES_ADIANTE = proxMesReferencia(MES_CORRENTE)

function cartao(id: number, nome: string): Cartao {
  return {
    id,
    nome,
    diaFechamento: 5,
    diaVencimento: 12,
    cor: '#ff7a00',
    ativo: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
}

function fatura(id: number, cartaoId: number, mesReferencia: string): FaturaComTotal {
  return {
    fatura: {
      id,
      cartaoId,
      mesReferencia,
      dataFechamento: `${mesReferencia}-05`,
      dataVencimento: `${mesReferencia}-12`,
      status: { kind: 'Aberta' },
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    },
    mesReferencia,
    totalCentavos: 117071,
    pagoParcialCentavos: 0,
    restanteCentavos: 117071
  }
}

const GRUPOS: GrupoFaturasCartao[] = [
  {
    cartao: cartao(1, 'Inter'),
    faturas: [fatura(10, 1, MES_CORRENTE), fatura(11, 1, MES_ADIANTE)]
  },
  { cartao: cartao(2, 'Nubank'), faturas: [fatura(20, 2, MES_CORRENTE)] }
]

function renderTrilho(mesDoPainel: string | null) {
  return render(
    <TrilhoCartoes
      grupos={GRUPOS}
      cartaoSelecionadoId={1}
      mesDoPainel={mesDoPainel}
      onSelecionar={() => {}}
    />
  )
}

function card(nome: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${nome}`) })
}

describe('TrilhoCartoes', () => {
  afterEach(cleanup)

  // O card é o resumo de hoje E o seletor do painel. Sem nomear o mês, o total
  // dele e o do painel ficam sem referência que os distinga.
  it('cada card nomeia a fatura que está exibindo', () => {
    renderTrilho(MES_CORRENTE)

    const rotulo = formatarMesReferencia(MES_CORRENTE)
    expect(within(card('Inter')).getByText(rotulo)).toBeTruthy()
    expect(within(card('Nubank')).getByText(rotulo)).toBeTruthy()
  })

  it('não oferece a volta quando o painel está na própria fatura corrente', () => {
    renderTrilho(MES_CORRENTE)

    expect(screen.queryByText(/^voltar para/)).toBeNull()
  })

  // O defeito relatado: os passadores levam o painel adiante e o card segue no
  // mês corrente, com dois totais na tela e nada explicando a diferença. O
  // aviso era uma linha a mais no card ("painel em dezembro de 2026"), que
  // aumentava a fileira inteira e empurrava a página — as setas inclusive —
  // no primeiro clique para fora da fatura corrente. Agora é a própria linha
  // do mês que muda, e diz para onde o clique no card leva.
  it('com o painel em outra fatura, a linha do mês do card em foco oferece a volta', () => {
    renderTrilho(MES_ADIANTE)

    const rotulo = formatarMesReferencia(MES_CORRENTE)
    expect(within(card('Inter')).getByText(`voltar para ${rotulo}`)).toBeTruthy()
    // No lugar do mês, e não além dele: o card não ganha linha.
    expect(within(card('Inter')).queryByText(rotulo)).toBeNull()
  })

  // O painel é de um cartão só: marcar o Nubank também transformaria o aviso em
  // ruído de fundo, e ele não tem par com que divergir.
  it('cartão fora de foco não recebe o aviso', () => {
    renderTrilho(MES_ADIANTE)

    expect(within(card('Nubank')).queryByText(/^voltar para/)).toBeNull()
    expect(within(card('Nubank')).getByText(formatarMesReferencia(MES_CORRENTE))).toBeTruthy()
  })

  // O teto de largura da fileira sai desta conta no CSS. Sem o número, ele cai
  // no padrão de um cartão e espreme a fileira inteira em 300px.
  it('informa ao CSS quantos cartões a fileira tem', () => {
    renderTrilho(MES_CORRENTE)

    const trilho = screen.getByRole('group', { name: 'Cartões' })
    expect(trilho.style.getPropertyValue('--cartoes')).toBe(String(GRUPOS.length))
  })
})

/**
 * O prazo do card, com hoje fixo em 29/09/2026 (só o `Date` é falso: os timers
 * do Testing Library seguem reais).
 */
describe('TrilhoCartoes — prazo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  function faturaEm(status: StatusFatura, vencimento: string): FaturaComTotal {
    return {
      fatura: {
        id: 90,
        cartaoId: 1,
        mesReferencia: '2026-09',
        dataFechamento: '2026-09-24',
        dataVencimento: vencimento,
        status,
        createdAt: '',
        updatedAt: ''
      },
      mesReferencia: '2026-09',
      totalCentavos: 183881,
      pagoParcialCentavos: 0,
      restanteCentavos: 183881
    }
  }

  function renderUm(fatura: FaturaComTotal, ativo = true) {
    const inter = { ...cartao(1, 'Inter'), ativo }
    render(
      <TrilhoCartoes
        grupos={[{ cartao: inter, faturas: [fatura] }]}
        cartaoSelecionadoId={1}
        mesDoPainel="2026-09"
        onSelecionar={() => {}}
      />
    )
  }

  // O caso do print: a fatura do Inter vence em 01/10 e o card dizia só "vence
  // 01/10", no mesmo cinza de um prazo distante.
  it('fatura Fechada perto do vencimento avisa, em tom de atenção', () => {
    renderUm(faturaEm({ kind: 'Fechada' }, '2026-10-01'))

    const aviso = within(card('Inter')).getByText('vence em 2 dias')
    expect(aviso.getAttribute('data-tom')).toBe('atencao')
  })

  it('fatura vencida avisa em tom de alerta', () => {
    renderUm(faturaEm({ kind: 'Fechada' }, '2026-09-10'))

    const aviso = within(card('Inter')).getByText('vencida há 19 dias')
    expect(aviso.getAttribute('data-tom')).toBe('alerta')
  })

  it('prazo distante fica neutro', () => {
    renderUm(faturaEm({ kind: 'Fechada' }, '2026-10-20'))

    const prazo = within(card('Inter')).getByText('vence 20/10')
    expect(prazo.getAttribute('data-tom')).toBeNull()
  })

  it('fatura paga diz quando foi paga, e não quando vence', () => {
    renderUm(faturaEm({ kind: 'Paga', pagaEm: '2026-09-20' }, '2026-10-01'))

    expect(within(card('Inter')).getByText('paga em 20/09')).toBeTruthy()
    expect(within(card('Inter')).queryByText(/^vence/)).toBeNull()
  })

  it('cartão arquivado leva o selo', () => {
    renderUm(faturaEm({ kind: 'Fechada' }, '2026-10-20'), false)

    expect(within(card('Inter')).getByText('Arquivado')).toBeTruthy()
  })

  /**
   * RN-10 no trilho: o número do card é o que falta pagar. Era o total, e por
   * isso o card seguia mostrando um valor que o banco já não cobrava.
   */
  describe('pagamento parcial', () => {
    function comParcial(pagoParcialCentavos: number, vencimento = '2026-10-20'): FaturaComTotal {
      const base = faturaEm({ kind: 'Fechada' }, vencimento)
      return {
        ...base,
        pagoParcialCentavos,
        restanteCentavos: base.totalCentavos - pagoParcialCentavos
      }
    }

    it('o card mostra o que falta pagar, com o parcial como contexto', () => {
      renderUm(comParcial(40000))

      expect(within(card('Inter')).getByText(/^R\$\s*1\.438,81$/)).toBeTruthy()
      expect(
        within(card('Inter')).getByText(/^R\$\s*400,00 pagos de R\$\s*1\.838,81$/)
      ).toBeTruthy()
    })

    it('sem parcial, o card mostra o total e não ganha a linha de contexto', () => {
      renderUm(faturaEm({ kind: 'Fechada' }, '2026-10-20'))

      expect(within(card('Inter')).getByText(/^R\$\s*1\.838,81$/)).toBeTruthy()
      expect(within(card('Inter')).queryByText(/pagos de/)).toBeNull()
    })

    // "R$ 400,00 pagos de R$ 1.838,81" ao lado do selo "Paga" se lê como se só
    // uma parte tivesse sido paga.
    it('em fatura paga, o contexto diz só quanto foi em pagamentos parciais', () => {
      const paga = faturaEm({ kind: 'Paga', pagaEm: '2026-09-20' }, '2026-10-01')
      renderUm({
        ...paga,
        pagoParcialCentavos: 40000,
        restanteCentavos: paga.totalCentavos - 40000
      })

      expect(within(card('Inter')).getByText(/^R\$\s*400,00 em pagamentos parciais$/)).toBeTruthy()
      expect(within(card('Inter')).queryByText(/pagos de/)).toBeNull()
    })

    // Tudo pago em parciais, fatura ainda não marcada como paga: o prazo fica
    // neutro. "vencida há 19 dias" em vermelho seria alarme falso.
    it('fatura quitada por parciais não alarma o prazo', () => {
      renderUm(comParcial(183881, '2026-09-10'))

      expect(within(card('Inter')).queryByText(/vencida há/)).toBeNull()
      const prazo = within(card('Inter')).getByText('vence 10/09')
      expect(prazo.getAttribute('data-tom')).toBeNull()
    })
  })
})
