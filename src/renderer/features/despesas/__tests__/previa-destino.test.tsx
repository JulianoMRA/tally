// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { Cartao } from '@domain/entities/cartao'
import { PreviaDestino } from '../PreviaDestino'

const INTER: Cartao = {
  id: 1,
  nome: 'Inter',
  diaFechamento: 5,
  diaVencimento: 12,
  cor: '#ff7a00',
  ativo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

const CARTOES = [INTER]

afterEach(cleanup)

describe('PreviaDestino — RN-01 aplicado na digitação', () => {
  it('compra antes do fechamento cai na fatura do próprio mês', () => {
    render(<PreviaDestino cartoes={CARTOES} cartaoId={1} dataCompra="2026-06-03" />)

    expect(screen.getByText(/junho de 2026/)).toBeTruthy()
    expect(screen.getByText('Inter')).toBeTruthy()
  })

  // É o caso que a prévia existe para evitar: hoje só se descobre depois de
  // salvar e navegar até Faturas.
  it('compra no dia do fechamento já cai na fatura seguinte', () => {
    render(<PreviaDestino cartoes={CARTOES} cartaoId={1} dataCompra="2026-06-05" />)

    expect(screen.getByText(/julho de 2026/)).toBeTruthy()
  })

  it('compra depois do fechamento cai na fatura seguinte', () => {
    render(<PreviaDestino cartoes={CARTOES} cartaoId={1} dataCompra="2026-06-28" />)

    expect(screen.getByText(/julho de 2026/)).toBeTruthy()
  })

  it('vira o ano quando a compra é em dezembro depois do fechamento', () => {
    render(<PreviaDestino cartoes={CARTOES} cartaoId={1} dataCompra="2026-12-20" />)

    expect(screen.getByText(/janeiro de 2027/)).toBeTruthy()
  })

  it('informa os dias de fechamento e vencimento do cartão', () => {
    render(<PreviaDestino cartoes={CARTOES} cartaoId={1} dataCompra="2026-06-03" />)

    expect(screen.getByText(/fecha dia 5 e vence dia 12/)).toBeTruthy()
  })

  it('usa o sujeito recebido, para parcelada e assinatura', () => {
    render(
      <PreviaDestino
        cartoes={CARTOES}
        cartaoId={1}
        dataCompra="2026-06-03"
        sujeito="A 1ª parcela"
      />
    )

    expect(screen.getByText(/A 1ª parcela entra na fatura/)).toBeTruthy()
  })
})

describe('PreviaDestino — some quando não há o que prever', () => {
  it('não renderiza sem cartão escolhido', () => {
    const { container } = render(
      <PreviaDestino cartoes={CARTOES} cartaoId={undefined} dataCompra="2026-06-03" />
    )

    expect(container.firstChild).toBeNull()
  })

  it('não renderiza sem data', () => {
    const { container } = render(
      <PreviaDestino cartoes={CARTOES} cartaoId={1} dataCompra={undefined} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('não renderiza quando o cartão escolhido não está na lista', () => {
    const { container } = render(
      <PreviaDestino cartoes={CARTOES} cartaoId={99} dataCompra="2026-06-03" />
    )

    expect(container.firstChild).toBeNull()
  })

  // O input date entrega valores parciais enquanto se digita; piscar erro ali
  // seria pior que não mostrar nada.
  it('não quebra com data incompleta', () => {
    const { container } = render(
      <PreviaDestino cartoes={CARTOES} cartaoId={1} dataCompra="2026-06" />
    )

    expect(container.firstChild).toBeNull()
  })

  it('não quebra com data impossível', () => {
    const { container } = render(
      <PreviaDestino cartoes={CARTOES} cartaoId={1} dataCompra="2026-02-31" />
    )

    expect(container.firstChild).toBeNull()
  })
})
