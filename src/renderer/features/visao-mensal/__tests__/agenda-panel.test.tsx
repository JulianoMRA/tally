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
  totalCentavos: 41235
}

const FECHAMENTO: EventoAgenda = {
  kind: 'FechamentoFatura',
  data: '2026-09-03',
  cartaoNome: 'Nubank',
  cartaoCor: '#820ad1',
  totalCentavos: 128490
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
    render(<AgendaPanel eventos={[VENCIMENTO, FECHAMENTO]} diasNoHorizonte={15} />)

    expect(screen.getByText('20 ago')).toBeTruthy()
    expect(screen.getByText('03 set')).toBeTruthy()
  })

  it('apresenta vencimento de fatura como saída, com sinal', () => {
    render(<AgendaPanel eventos={[VENCIMENTO]} diasNoHorizonte={15} />)

    expect(screen.getByText('Fatura Inter')).toBeTruthy()
    expect(screen.getByText('vencimento')).toBeTruthy()
    expect(screen.getByText(/^-R\$\s*412,35$/)).toBeTruthy()
  })

  it('apresenta recebimento previsto como entrada, com sinal', () => {
    render(<AgendaPanel eventos={[RECEBIMENTO]} diasNoHorizonte={15} />)

    expect(screen.getByText('Ajuda família')).toBeTruthy()
    expect(screen.getByText(/^\+R\$\s*700,00$/)).toBeTruthy()
  })

  // Fechar não move dinheiro — só congela o que já foi gasto. Um valor com
  // sinal ali somaria duas vezes na leitura de quem varre a coluna.
  it('fechamento de fatura não exibe valor com sinal, só o acumulado', () => {
    render(<AgendaPanel eventos={[FECHAMENTO]} diasNoHorizonte={15} />)

    expect(screen.getByText('Nubank fecha')).toBeTruthy()
    expect(screen.getByText(/R\$\s*1\.284,90 acumulados/)).toBeTruthy()
    expect(screen.queryByText(/^-R\$\s*1\.284,90$/)).toBeNull()
  })

  it('nomeia recebimento avulso sem fonte vinculada', () => {
    render(<AgendaPanel eventos={[{ ...RECEBIMENTO, fonte: null }]} diasNoHorizonte={15} />)

    expect(screen.getByText('Recebimento avulso')).toBeTruthy()
  })

  it('mostra o horizonte no meta do painel, pluralizado', () => {
    const { rerender } = render(<AgendaPanel eventos={[VENCIMENTO]} diasNoHorizonte={15} />)
    expect(screen.getByText('próximos 15 dias')).toBeTruthy()

    rerender(<AgendaPanel eventos={[VENCIMENTO]} diasNoHorizonte={1} />)
    expect(screen.getByText('próximos 1 dia')).toBeTruthy()
  })

  it('mostra estado vazio quando nada está previsto', () => {
    render(<AgendaPanel eventos={[]} diasNoHorizonte={15} />)

    expect(screen.getByText('Nada previsto até o fim do mês.')).toBeTruthy()
  })
})
