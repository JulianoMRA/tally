// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { StatusFatura } from '@domain/entities/fatura'
import type { FaturaComTotal } from '@shared/ipc/fatura'
import { HistoricoFaturas } from '../HistoricoFaturas'

let proximoId = 1

/** Toda fatura tem total de R$ 100,00; `pagoParcialCentavos` abate dele. */
function fatura(
  mesReferencia: string,
  status: StatusFatura,
  pagoParcialCentavos = 0
): FaturaComTotal {
  return {
    fatura: {
      id: proximoId++,
      cartaoId: 1,
      mesReferencia,
      dataFechamento: `${mesReferencia}-05`,
      dataVencimento: `${mesReferencia}-12`,
      status,
      createdAt: '',
      updatedAt: ''
    },
    mesReferencia,
    totalCentavos: 10000,
    pagoParcialCentavos,
    restanteCentavos: 10000 - pagoParcialCentavos
  }
}

// Hoje é 29/09/2026: agosto venceu em 12/08, junho e julho foram pagos.
const FATURAS = [
  fatura('2026-06', { kind: 'Paga', pagaEm: '2026-06-10' }),
  fatura('2026-07', { kind: 'Paga', pagaEm: '2026-07-11' }),
  fatura('2026-08', { kind: 'Fechada' }),
  fatura('2026-09', { kind: 'Aberta' })
]

function renderizar(faturas: FaturaComTotal[] = FATURAS) {
  render(
    <HistoricoFaturas
      faturas={faturas}
      mesAtual="2026-09"
      faturaAbertaId={faturas[faturas.length - 1]!.fatura.id}
      cartaoCor="#f70"
      onAbrir={() => {}}
    />
  )
}

function abas() {
  return screen.getByRole('radiogroup', { name: 'Filtrar faturas por status' })
}

function contagens() {
  return within(abas())
    .getAllByRole('radio')
    .map((r) => r.textContent)
}

async function abrirLista() {
  const usuario = userEvent.setup()
  await usuario.click(screen.getByRole('button', { name: /meses anteriores/ }))
  return usuario
}

describe('HistoricoFaturas', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  // "Abertas" quase nunca tinha item, e as três abas de status não diziam
  // quantas havia em cada uma: para saber se algo ficou sem pagar era preciso
  // clicar. "A pagar" e "Pagas" somam "Todas".
  it('as abas são Todas, A pagar e Pagas, cada uma com a contagem', () => {
    renderizar()

    expect(contagens()).toEqual(['Todas 3', 'A pagar 1', 'Pagas 2'])
  })

  // A meta do painel era um "3" sem rótulo, repetindo a linha de baixo
  // ("Mostrar 3 faturas de meses anteriores").
  it('não repete a contagem solta no cabeçalho', () => {
    renderizar()

    expect(screen.queryByText('3', { exact: true })).toBeNull()
  })

  it('escolher uma aba abre a lista', async () => {
    renderizar()
    const usuario = userEvent.setup()
    const expandir = screen.getByRole('button', { name: /meses anteriores/ })
    expect(expandir.getAttribute('aria-expanded')).toBe('false')

    await usuario.click(within(abas()).getByRole('radio', { name: /^A pagar/ }))

    expect(expandir.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Agosto de 2026')).toBeTruthy()
    expect(screen.queryByText('Julho de 2026')).toBeNull()
  })

  it('a linha paga diz quando foi paga, no lugar do vencimento', async () => {
    renderizar()
    await abrirLista()

    const julho = screen.getByRole('button', { name: /Julho de 2026/ })
    expect(within(julho).getByText(/Paga em 11\/07\/2026/)).toBeTruthy()
    expect(within(julho).queryByText(/Vence/)).toBeNull()
  })

  it('a linha não paga e vencida avisa, em tom de alerta', async () => {
    renderizar()
    await abrirLista()

    const agosto = screen.getByRole('button', { name: /Agosto de 2026/ })
    const aviso = within(agosto).getByText('vencida há 48 dias')
    expect(aviso.getAttribute('data-tom')).toBe('alerta')
  })
})

/**
 * RN-10 no Histórico: a linha mostra o que falta pagar, com o total como
 * contexto, e a barra diz quanto falta pagar na lista.
 */
describe('HistoricoFaturas — pagamento parcial', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  // Julho pago, agosto com R$ 40 pagos de R$ 100, setembro é a fatura em tela.
  function comParcialEmAgosto(): FaturaComTotal[] {
    return [
      fatura('2026-07', { kind: 'Paga', pagaEm: '2026-07-11' }),
      fatura('2026-08', { kind: 'Fechada' }, 4000),
      fatura('2026-09', { kind: 'Aberta' })
    ]
  }

  it('a linha com parcial mostra o que falta pagar e de quanto', async () => {
    renderizar(comParcialEmAgosto())
    await abrirLista()

    const agosto = screen.getByRole('button', { name: /Agosto de 2026/ })
    expect(within(agosto).getByText(/^R\$\s*60,00$/)).toBeTruthy()
    expect(within(agosto).getByText(/R\$\s*40,00 pagos de R\$\s*100,00/)).toBeTruthy()
  })

  it('a linha sem parcial não ganha o contexto', async () => {
    renderizar(comParcialEmAgosto())
    await abrirLista()

    const julho = screen.getByRole('button', { name: /Julho de 2026/ })
    expect(within(julho).getByText(/^R\$\s*100,00$/)).toBeTruthy()
    expect(within(julho).queryByText(/pagos de/)).toBeNull()
  })

  // "R$ 40,00 pagos de R$ 100,00" ao lado do selo "Paga" se lê como se só uma
  // parte tivesse sido paga.
  it('em fatura paga, o contexto diz só quanto foi em pagamentos parciais', async () => {
    renderizar([
      fatura('2026-07', { kind: 'Paga', pagaEm: '2026-07-11' }, 4000),
      fatura('2026-09', { kind: 'Aberta' })
    ])
    await abrirLista()

    const julho = screen.getByRole('button', { name: /Julho de 2026/ })
    expect(within(julho).getByText(/R\$\s*40,00 em pagamentos parciais/)).toBeTruthy()
    expect(within(julho).queryByText(/pagos de/)).toBeNull()
  })

  // Era um número sem rótulo: 100 de julho, já pagos, mais os 60 que faltam de
  // agosto. Só os 60 estão por pagar.
  it('a barra diz quanto falta pagar, sem somar o que já foi quitado', () => {
    renderizar(comParcialEmAgosto())

    expect(screen.getByText(/^R\$\s*60,00 a pagar$/)).toBeTruthy()
    expect(screen.queryByText(/160,00/)).toBeNull()
  })

  it('na aba Pagas a barra não mostra valor', async () => {
    renderizar(comParcialEmAgosto())
    const usuario = userEvent.setup()

    await usuario.click(within(abas()).getByRole('radio', { name: /^Pagas/ }))

    expect(screen.queryByText(/a pagar$/)).toBeNull()
  })

  // Fatura Fechada com tudo pago em parciais: não há o que pagar, só o que
  // marcar. "vencida há 48 dias" em vermelho seria alarme falso.
  it('a fatura quitada por parciais não diz que está vencida', async () => {
    renderizar([
      fatura('2026-08', { kind: 'Fechada' }, 10000),
      fatura('2026-09', { kind: 'Aberta' })
    ])
    await abrirLista()

    const agosto = screen.getByRole('button', { name: /Agosto de 2026/ })
    expect(within(agosto).queryByText(/vencida há/)).toBeNull()
    expect(within(agosto).getByText(/^R\$\s*0,00$/)).toBeTruthy()
  })
})
