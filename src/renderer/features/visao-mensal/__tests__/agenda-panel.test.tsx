// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { EventoAgenda } from '@domain/services/montar-agenda-do-mes'
import { AgendaPanel } from '../AgendaPanel'

const VENCIMENTO: EventoAgenda = {
  kind: 'VencimentoFatura',
  data: '2026-08-20',
  cartaoNome: 'Inter',
  cartaoCor: '#ff7a00',
  restanteCentavos: 41235
}

const FECHAMENTO: EventoAgenda = {
  kind: 'FechamentoFatura',
  data: '2026-09-03',
  cartaoNome: 'Nubank',
  cartaoCor: '#820ad1',
  restanteCentavos: 128490,
  temPagamentoParcial: false
}

const RECEBIMENTO: EventoAgenda = {
  kind: 'RecebimentoPrevisto',
  data: '2026-08-25',
  fonte: 'Ajuda família',
  valorCentavos: 70000
}

describe('AgendaPanel', () => {
  afterEach(cleanup)

  it('mostra o dia com o mês abreviado, porque a lista atravessa a virada', () => {
    render(<AgendaPanel eventos={[VENCIMENTO, FECHAMENTO]} horizonte="próximos 15 dias" />)

    expect(screen.getByText('20 ago')).toBeTruthy()
    expect(screen.getByText('03 set')).toBeTruthy()
  })

  it('apresenta vencimento de fatura como saída, com sinal', () => {
    render(<AgendaPanel eventos={[VENCIMENTO]} horizonte="próximos 15 dias" />)

    expect(screen.getByText('Fatura Inter')).toBeTruthy()
    expect(screen.getByText('vencimento')).toBeTruthy()
    expect(screen.getByText(/^-R\$\s*412,35$/)).toBeTruthy()
  })

  it('apresenta recebimento previsto como entrada, com sinal', () => {
    render(<AgendaPanel eventos={[RECEBIMENTO]} horizonte="próximos 15 dias" />)

    expect(screen.getByText('Ajuda família')).toBeTruthy()
    expect(screen.getByText(/^\+R\$\s*700,00$/)).toBeTruthy()
  })

  // Fechar não move dinheiro — só congela o que já foi gasto. Um valor com
  // sinal ali somaria duas vezes na leitura de quem varre a coluna.
  it('fechamento de fatura não exibe valor com sinal, só o acumulado', () => {
    render(<AgendaPanel eventos={[FECHAMENTO]} horizonte="próximos 15 dias" />)

    expect(screen.getByText('Nubank fecha')).toBeTruthy()
    expect(screen.getByText(/R\$\s*1\.284,90 acumulados/)).toBeTruthy()
    expect(screen.queryByText(/^-R\$\s*1\.284,90$/)).toBeNull()
  })

  // RN-10: com pagamento parcial o valor do evento já vem abatido, e
  // "acumulados" diria que a fatura acumulou menos do que foi comprado.
  it('fechamento de fatura com pagamento parcial diz quanto falta pagar', () => {
    render(
      <AgendaPanel
        eventos={[{ ...FECHAMENTO, restanteCentavos: 60000, temPagamentoParcial: true }]}
        horizonte="próximos 15 dias"
      />
    )

    expect(screen.getByText(/^R\$\s*600,00 a pagar$/)).toBeTruthy()
    expect(screen.queryByText(/acumulados/)).toBeNull()
    expect(screen.queryByText(/^-R\$\s*600,00$/)).toBeNull()
  })

  it('vencimento mostra como saída o que falta pagar', () => {
    render(
      <AgendaPanel
        eventos={[{ ...VENCIMENTO, restanteCentavos: 7000 }]}
        horizonte="próximos 15 dias"
      />
    )

    expect(screen.getByText(/^-R\$\s*70,00$/)).toBeTruthy()
  })

  it('nomeia recebimento avulso sem fonte vinculada', () => {
    render(<AgendaPanel eventos={[{ ...RECEBIMENTO, fonte: null }]} horizonte="próximos 15 dias" />)

    expect(screen.getByText('Recebimento avulso')).toBeTruthy()
  })

  // Quem decide o texto é `rotuloHorizonte`: em mês futuro o horizonte é o mês
  // inteiro, e o painel não pode ancorá-lo em hoje com um "próximos".
  it('exibe o rótulo de horizonte que recebe, sem reinterpretá-lo', () => {
    const { rerender } = render(<AgendaPanel eventos={[VENCIMENTO]} horizonte="próximos 15 dias" />)
    expect(screen.getByText('próximos 15 dias')).toBeTruthy()

    rerender(<AgendaPanel eventos={[VENCIMENTO]} horizonte="os 31 dias do mês" />)
    expect(screen.getByText('os 31 dias do mês')).toBeTruthy()
    expect(screen.queryByText(/próximos/)).toBeNull()
  })

  it('mostra estado vazio quando nada está previsto', () => {
    render(<AgendaPanel eventos={[]} horizonte="próximos 15 dias" />)

    expect(screen.getByText('Nada previsto até o fim do mês.')).toBeTruthy()
  })
})
