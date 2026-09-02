// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import type { Cartao } from '@domain/entities/cartao'
import type { FaturaComTotal } from '@shared/ipc/fatura'
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
    totalCentavos: 117071
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

  it('não anuncia divergência quando o painel está na própria fatura corrente', () => {
    renderTrilho(MES_CORRENTE)

    expect(screen.queryByText(/^painel em/)).toBeNull()
  })

  // O defeito relatado: os passadores levam o painel adiante e o card segue no
  // mês corrente, com dois totais na tela e nada explicando a diferença.
  it('o card em foco admite quando o painel saiu da fatura corrente', () => {
    renderTrilho(MES_ADIANTE)

    expect(
      within(card('Inter')).getByText(`painel em ${formatarMesReferencia(MES_ADIANTE)}`)
    ).toBeTruthy()
  })

  // O painel é de um cartão só: marcar o Nubank também transformaria o aviso em
  // ruído de fundo, e ele não tem par com que divergir.
  it('cartão fora de foco não recebe o aviso', () => {
    renderTrilho(MES_ADIANTE)

    expect(within(card('Nubank')).queryByText(/^painel em/)).toBeNull()
  })
})
