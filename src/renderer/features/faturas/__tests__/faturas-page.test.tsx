// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { Cartao } from '@domain/entities/cartao'
import type { StatusFatura } from '@domain/entities/fatura'
import type { PagamentoParcial } from '@domain/entities/pagamento-parcial'
import type { Parcela } from '@domain/entities/parcela'
import type { FaturaComTotal, FaturaDetalhada } from '@shared/ipc/fatura'
import { ToastProvider } from '../../../components/ui'
import { cartao } from '../../../__tests__/__fixtures__/builders'
import FaturasPage from '../FaturasPage'

const INTER = cartao({ id: 1, nome: 'Inter' })
const ANTIGO = cartao({ id: 2, nome: 'Antigo', ativo: false })

function fatura(
  id: number,
  cartaoId: number,
  mesReferencia: string,
  status: StatusFatura,
  totalCentavos = 10000
): FaturaComTotal {
  return {
    fatura: {
      id,
      cartaoId,
      mesReferencia,
      dataFechamento: `${mesReferencia}-05`,
      dataVencimento: `${mesReferencia}-12`,
      status,
      createdAt: '',
      updatedAt: ''
    },
    mesReferencia,
    totalCentavos,
    pagoParcialCentavos: 0,
    restanteCentavos: totalCentavos
  }
}

function parcela(id: number, faturaId: number, valorCentavos: number): Parcela {
  return {
    id,
    despesaId: id,
    faturaId,
    numero: 1,
    total: 1,
    valorCentavos,
    dataReferencia: '2026-09-01',
    status: 'Pendente',
    dataPagamento: null,
    createdAt: '',
    updatedAt: ''
  }
}

/**
 * Dublê do `window.api` com o que a tela carrega: os cartões (arquivados
 * inclusive), o resumo das faturas de cada um e o detalhe da fatura em foco.
 * `parcelasPorFatura` só entra onde o teste precisa da tabela na tela.
 */
function instalarApi(
  cartoes: Cartao[],
  faturasPorCartao: Record<number, FaturaComTotal[]>,
  parcelasPorFatura: Record<number, Parcela[]> = {}
) {
  const todas = Object.values(faturasPorCartao).flat()
  const pagamentos: PagamentoParcial[] = []
  const api = {
    // Como o repositório: os arquivados só vêm quando pedidos.
    cartao: {
      list: vi.fn(async (opcoes?: { incluirArquivados?: boolean }) =>
        opcoes?.incluirArquivados ? cartoes : cartoes.filter((c) => c.ativo)
      )
    },
    categoria: { list: vi.fn().mockResolvedValue([]) },
    fatura: {
      listarResumoPorCartao: vi.fn(async (id: number) => faturasPorCartao[id] ?? []),
      detalharComParcelas: vi.fn(async (id: number): Promise<FaturaDetalhada | null> => {
        const alvo = todas.find((f) => f.fatura.id === id)
        return alvo
          ? {
              fatura: alvo.fatura,
              parcelas: parcelasPorFatura[id] ?? [],
              totalCentavos: alvo.totalCentavos,
              pagoParcialCentavos: alvo.pagoParcialCentavos,
              restanteCentavos: alvo.restanteCentavos,
              excedenteCentavos: 0,
              pagamentosParciais: pagamentos.filter((p) => p.faturaId === id)
            }
          : null
      }),
      // Muta o dublê como o banco faria: o resumo e o detalhe da próxima carga
      // já veem o pagamento.
      registrarPagamentoParcial: vi.fn(
        async (input: { faturaId: number; valorCentavos: number; dataPagamento: string }) => {
          const alvo = todas.find((f) => f.fatura.id === input.faturaId)
          if (!alvo) throw new Error(`Fatura #${input.faturaId} não encontrada`)
          alvo.pagoParcialCentavos += input.valorCentavos
          alvo.restanteCentavos -= input.valorCentavos
          const pagamento = { id: pagamentos.length + 1, ...input, createdAt: '', updatedAt: '' }
          pagamentos.push(pagamento)
          return pagamento
        }
      ),
      // Muta o dublê como o banco faria: a próxima carga já vê a fatura paga.
      pagar: vi.fn(async (id: number, dataPagamento: string) => {
        const alvo = todas.find((f) => f.fatura.id === id)
        if (!alvo) throw new Error(`Fatura #${id} não encontrada`)
        alvo.fatura = { ...alvo.fatura, status: { kind: 'Paga', pagaEm: dataPagamento } }
        return alvo.fatura
      })
    }
  }
  vi.stubGlobal('window', Object.assign(window, { api }))
  return api
}

function renderizar(url = '/faturas') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <FaturasPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

function trilho() {
  return screen.getByRole('group', { name: 'Cartões' })
}

describe('FaturasPage — cartão arquivado (RF-CAR-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('pede os cartões com os arquivados', async () => {
    const api = instalarApi([INTER], { 1: [fatura(10, 1, '2026-09', { kind: 'Aberta' })] })
    renderizar()

    await screen.findByRole('group', { name: 'Cartões' })
    expect(api.cartao.list).toHaveBeenCalledWith({ incluirArquivados: true })
  })

  // Trocar de cartão com uma compra em 12x ainda correndo: as faturas do
  // cartão arquivado seguiam no saldo e na Visão mensal, e não havia onde
  // pagá-las.
  it('mostra o arquivado com fatura a pagar, com o selo, depois dos ativos', async () => {
    instalarApi([ANTIGO, INTER], {
      1: [fatura(10, 1, '2026-09', { kind: 'Aberta' })],
      2: [fatura(20, 2, '2026-08', { kind: 'Fechada' })]
    })
    renderizar()

    const antigo = await within(await screen.findByRole('group', { name: 'Cartões' })).findByRole(
      'button',
      { name: /^Antigo/ }
    )
    expect(within(antigo).getByText('Arquivado')).toBeTruthy()
    const nomes = within(trilho())
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
    expect(nomes[0]).toMatch(/^Inter/)
    expect(nomes[1]).toMatch(/^Antigo/)
  })

  it('deixa de fora o arquivado com tudo pago', async () => {
    instalarApi([INTER, ANTIGO], {
      1: [fatura(10, 1, '2026-09', { kind: 'Aberta' })],
      2: [fatura(20, 2, '2026-08', { kind: 'Paga', pagaEm: '2026-08-10' })]
    })
    renderizar()

    await within(await screen.findByRole('group', { name: 'Cartões' })).findByRole('button', {
      name: /^Inter/
    })
    expect(within(trilho()).queryByRole('button', { name: /^Antigo/ })).toBeNull()
  })

  // O link da Visão mensal aponta para a fatura mesmo depois de paga. A tela
  // caía no primeiro cartão ativo e afirmava que a fatura não existia mais.
  it('o link para fatura de cartão arquivado abre essa fatura, sem aviso falso', async () => {
    instalarApi([INTER, ANTIGO], {
      1: [fatura(10, 1, '2026-09', { kind: 'Aberta' })],
      2: [fatura(20, 2, '2026-08', { kind: 'Paga', pagaEm: '2026-08-10' })]
    })
    renderizar('/faturas?cartaoId=2&faturaId=20')

    expect(await screen.findByRole('heading', { name: 'Antigo · Agosto de 2026' })).toBeTruthy()
    expect(within(trilho()).getByRole('button', { name: /^Antigo/ })).toBeTruthy()
    expect(screen.queryByText(/não existe mais/)).toBeNull()
  })
})

describe('FaturasPage — pagar a última fatura de um arquivado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  // Sem nada a pagar ele deixaria o trilho — mas não debaixo do painel que o
  // está mostrando, senão a tela pularia para outro cartão logo após o
  // pagamento.
  it('o arquivado em foco continua no trilho depois de pago', async () => {
    instalarApi([INTER, ANTIGO], {
      1: [fatura(10, 1, '2026-09', { kind: 'Aberta' })],
      2: [fatura(20, 2, '2026-08', { kind: 'Fechada' })]
    })
    renderizar()
    const usuario = userEvent.setup()

    const antigo = await within(await screen.findByRole('group', { name: 'Cartões' })).findByRole(
      'button',
      { name: /^Antigo/ }
    )
    await usuario.click(antigo)
    await screen.findByRole('heading', { name: 'Antigo · Agosto de 2026' })

    await usuario.click(screen.getByRole('button', { name: 'Marcar como paga' }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))

    expect(await screen.findByRole('button', { name: 'Reabrir fatura' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Antigo · Agosto de 2026' })).toBeTruthy()
    expect(within(trilho()).getByRole('button', { name: /^Antigo/ })).toBeTruthy()
  })
})

describe('FaturasPage — estados vazios', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  // O painel de baixo se chama "Lançamentos", como em Saídas: o subtítulo
  // falava em "parcelas" de uma lista que tem compra à vista.
  it('o subtítulo fala nos lançamentos da fatura em foco', async () => {
    instalarApi([], {})
    renderizar()

    expect(
      await screen.findByText('Situação de cada cartão e os lançamentos da fatura em foco.')
    ).toBeTruthy()
  })

  it('sem cartão nenhum, diz que não há cartão cadastrado', async () => {
    instalarApi([], {})
    renderizar()

    expect(await screen.findByText('Nenhum cartão cadastrado')).toBeTruthy()
  })

  // "Nenhum cartão cadastrado" com cartões arquivados no banco afirma sobre os
  // dados do usuário algo que não é verdade.
  it('só com arquivados sem nada a pagar, diz que não há cartão ativo', async () => {
    instalarApi([ANTIGO], { 2: [fatura(20, 2, '2026-08', { kind: 'Paga', pagaEm: '2026-08-10' })] })
    renderizar()

    expect(await screen.findByText('Nenhum cartão ativo')).toBeTruthy()
    expect(screen.queryByText('Nenhum cartão cadastrado')).toBeNull()
  })
})

// RF-FAT-06 — a navegação anda pelas faturas que existem, e as setas moram
// junto do título, nomeando o destino.
describe('FaturasPage — navegação entre faturas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('a seta leva à próxima fatura que existe, pulando o mês sem fatura', async () => {
    instalarApi([INTER], {
      1: [
        fatura(8, 1, '2026-08', { kind: 'Paga', pagaEm: '2026-08-10' }),
        fatura(9, 1, '2026-09', { kind: 'Fechada' }),
        fatura(11, 1, '2026-11', { kind: 'Aberta' })
      ]
    })
    renderizar()
    const usuario = userEvent.setup()

    await screen.findByRole('heading', { name: 'Inter · Setembro de 2026' })
    expect(screen.getByRole('button', { name: 'Fatura anterior: agosto de 2026' })).toBeTruthy()
    await usuario.click(screen.getByRole('button', { name: 'Próxima fatura: novembro de 2026' }))

    expect(await screen.findByRole('heading', { name: 'Inter · Novembro de 2026' })).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Sem próxima fatura' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })
})

/**
 * RF-FAT-07 — registrar um pagamento parcial muda três lugares da tela ao mesmo
 * tempo: a faixa, o card do trilho e a lista de pagamentos. Cada um lê de uma
 * carga diferente (o detalhe e o resumo por cartão), e um registro que
 * recarregasse só uma delas deixaria a tela mostrando dois valores para a
 * mesma fatura.
 */
describe('FaturasPage — pagamento parcial', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('registrar atualiza a faixa, o card do trilho e a lista de pagamentos', async () => {
    const api = instalarApi([INTER], { 1: [fatura(10, 1, '2026-09', { kind: 'Aberta' }, 80000)] })
    renderizar()
    const usuario = userEvent.setup({ delay: null })

    await screen.findByRole('heading', { name: 'Inter · Setembro de 2026' })
    await usuario.click(screen.getByRole('button', { name: 'Registrar pagamento parcial' }))
    const dialogo = screen.getByRole('dialog', { name: 'Registrar pagamento parcial' })
    await usuario.type(within(dialogo).getByLabelText('Valor (R$)'), '200,00')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar pagamento' }))

    expect(api.fatura.registrarPagamentoParcial).toHaveBeenCalledWith({
      faturaId: 10,
      valorCentavos: 20000,
      dataPagamento: '2026-09-29'
    })

    const pagamentos = await screen.findByRole('region', { name: 'Pagamentos parciais' })
    expect(within(pagamentos).getByText('29/09/2026')).toBeTruthy()

    const faixa = screen.getByRole('region', { name: 'Resumo da fatura' })
    expect(within(faixa).getByText('Falta pagar').parentElement?.textContent).toMatch(
      /R\$\s*600,00/
    )

    const card = within(trilho()).getByRole('button', { name: /^Inter/ })
    expect(within(card).getByText(/^R\$\s*600,00$/)).toBeTruthy()
    expect(within(card).getByText(/^R\$\s*200,00 pagos de R\$\s*800,00$/)).toBeTruthy()
  })
})

/** O cabeçalho ordenável da coluna Valor: a tabela de pagamentos tem um `th` simples. */
function colunaValor() {
  return screen.getByRole('button', { name: 'Valor' }).closest('th')
}

/**
 * Toda ação recarregava a tela inteira: `carregando` incluía o loading do
 * resumo, então trilho, painel e histórico desmontavam e nasciam de novo. O
 * conteúdo voltava certo — por isso nenhum teste reclamava —, mas o estado de
 * quem estava usando não: o histórico fechava, o filtro voltava para "Todas" e
 * a tabela, para a ordem da Compra.
 */
describe('FaturasPage — recarregar depois de uma ação', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  // Junho ficou sem pagar e está fora da janela da fatura corrente: é a linha
  // que a aba "A pagar" do histórico mostra. Setembro é a fatura do painel.
  function instalar() {
    return instalarApi(
      [INTER],
      {
        1: [
          fatura(6, 1, '2026-06', { kind: 'Fechada' }),
          fatura(7, 1, '2026-07', { kind: 'Paga', pagaEm: '2026-07-10' }),
          fatura(9, 1, '2026-09', { kind: 'Aberta' }, 80000)
        ]
      },
      { 9: [parcela(90, 9, 50000), parcela(91, 9, 30000)] }
    )
  }

  async function registrarParcial(usuario: ReturnType<typeof userEvent.setup>) {
    await usuario.click(screen.getByRole('button', { name: 'Registrar pagamento parcial' }))
    const dialogo = screen.getByRole('dialog', { name: 'Registrar pagamento parcial' })
    await usuario.type(within(dialogo).getByLabelText('Valor (R$)'), '200,00')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar pagamento' }))
    await screen.findByRole('region', { name: 'Pagamentos parciais' })
  }

  function abas() {
    return screen.getByRole('radiogroup', { name: 'Filtrar faturas por status' })
  }

  it('o trilho, o histórico aberto, a aba e a ordenação continuam como estavam', async () => {
    instalar()
    renderizar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByRole('heading', { name: 'Inter · Setembro de 2026' })

    await usuario.click(within(abas()).getByRole('radio', { name: /^A pagar/ }))
    await usuario.click(screen.getByRole('button', { name: 'Valor' }))
    const trilhoAntes = trilho()

    await registrarParcial(usuario)

    // O mesmo nó, e não um trilho igual: a tela não desmontou no caminho.
    expect(trilho()).toBe(trilhoAntes)
    expect(
      within(abas())
        .getByRole('radio', { name: /^A pagar/ })
        .getAttribute('aria-checked')
    ).toBe('true')
    expect(
      screen.getByRole('button', { name: /meses anteriores/ }).getAttribute('aria-expanded')
    ).toBe('true')
    expect(colunaValor()?.getAttribute('aria-sort')).toBe('ascending')
  })

  // `recarregarDetalhe` lia o detalhe e chamava dois callbacks, e cada um relia
  // o mesmo detalhe: três leituras para uma ação.
  it('lê o detalhe uma vez só', async () => {
    const api = instalar()
    renderizar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByRole('heading', { name: 'Inter · Setembro de 2026' })
    const leiturasAntes = api.fatura.detalharComParcelas.mock.calls.length

    await registrarParcial(usuario)

    expect(api.fatura.detalharComParcelas.mock.calls.length - leiturasAntes).toBe(1)
  })
})

/**
 * Trocar de fatura desmontava o painel: enquanto a nova carregava, o detalhe
 * saía da tela e levava junto a seta que tinha o foco e a ordenação escolhida.
 */
describe('FaturasPage — trocar de fatura sem desmontar o painel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
    emularFocoDoChromium()
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
    Reflect.deleteProperty(document, 'activeElement')
  })

  /**
   * No Chromium, `document.activeElement` responde `body` na mesma tarefa em
   * que o botão focado é desabilitado (medido no Electron 42, Chromium 148). O
   * jsdom segue respondendo o botão. A primeira versão da troca de foco
   * perguntava ao documento quem estava focado: passava aqui e perdia o foco
   * no app. Quem pegou foi o E2E — este dublê traz a diferença para o teste de
   * componente.
   */
  function emularFocoDoChromium() {
    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'activeElement')
    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get() {
        const focado = original?.get?.call(document) as Element | null
        return focado instanceof HTMLButtonElement && focado.disabled ? document.body : focado
      }
    })
  }

  // Setembro é a fatura corrente; novembro e dezembro vêm pela seta.
  function instalar() {
    return instalarApi(
      [INTER],
      {
        1: [
          fatura(8, 1, '2026-08', { kind: 'Paga', pagaEm: '2026-08-10' }),
          fatura(9, 1, '2026-09', { kind: 'Fechada' }),
          fatura(11, 1, '2026-11', { kind: 'Aberta' }),
          fatura(12, 1, '2026-12', { kind: 'Aberta' })
        ]
      },
      {
        9: [parcela(90, 9, 6000), parcela(91, 9, 4000)],
        11: [parcela(110, 11, 7000), parcela(111, 11, 3000)]
      }
    )
  }

  it('a seta acionada pelo teclado continua com o foco', async () => {
    instalar()
    renderizar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByRole('heading', { name: 'Inter · Setembro de 2026' })

    screen.getByRole('button', { name: 'Próxima fatura: novembro de 2026' }).focus()
    await usuario.keyboard('{Enter}')

    await screen.findByRole('heading', { name: 'Inter · Novembro de 2026' })
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Próxima fatura: dezembro de 2026' })
    )
  })

  // Na última fatura a seta fica desabilitada, e botão desabilitado não recebe
  // tecla: sem passar o foco adiante, a navegação por teclado morria ali.
  it('na última fatura, o foco passa para a seta que continua valendo', async () => {
    instalar()
    renderizar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByRole('heading', { name: 'Inter · Setembro de 2026' })

    screen.getByRole('button', { name: 'Próxima fatura: novembro de 2026' }).focus()
    await usuario.keyboard('{Enter}')
    await screen.findByRole('heading', { name: 'Inter · Novembro de 2026' })
    await usuario.keyboard('{Enter}')
    await screen.findByRole('heading', { name: 'Inter · Dezembro de 2026' })

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Fatura anterior: novembro de 2026' })
    )
  })

  it('a ordenação escolhida vale para a fatura seguinte', async () => {
    instalar()
    renderizar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByRole('heading', { name: 'Inter · Setembro de 2026' })

    await usuario.click(screen.getByRole('button', { name: 'Valor' }))
    await usuario.click(screen.getByRole('button', { name: 'Próxima fatura: novembro de 2026' }))
    await screen.findByRole('heading', { name: 'Inter · Novembro de 2026' })

    expect(colunaValor()?.getAttribute('aria-sort')).toBe('ascending')
  })

  // Com o painel montado, o erro de uma ação ficaria na tela ao trocar de
  // fatura: o "Banco indisponível" de setembro apareceria na faixa de novembro.
  it('o erro de uma ação do ciclo fica na fatura em que ocorreu', async () => {
    const api = instalar()
    api.fatura.pagar.mockRejectedValueOnce(new Error('Banco indisponível'))
    renderizar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByRole('heading', { name: 'Inter · Setembro de 2026' })

    await usuario.click(screen.getByRole('button', { name: 'Marcar como paga' }))
    const dialogo = screen.getByRole('dialog', { name: 'Marcar fatura como paga' })
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar pagamento' }))
    await within(dialogo).findByText('Banco indisponível')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    const faixa = screen.getByRole('region', { name: 'Resumo da fatura' })
    expect(within(faixa).getByText('Banco indisponível')).toBeTruthy()

    await usuario.click(screen.getByRole('button', { name: 'Próxima fatura: novembro de 2026' }))
    await screen.findByRole('heading', { name: 'Inter · Novembro de 2026' })

    expect(screen.queryByText('Banco indisponível')).toBeNull()
  })
})

/**
 * O histórico é o último bloco da página, e o painel que o clique troca fica
 * acima dele. Sem levar a vista e o foco até o título, o resultado visível do
 * clique era a linha sumir da lista.
 */
describe('FaturasPage — abrir uma fatura pelo histórico', () => {
  const scrollIntoView = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
    // O jsdom não implementa `scrollIntoView`.
    Element.prototype.scrollIntoView = scrollIntoView
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  })

  function instalar() {
    return instalarApi([INTER], {
      1: [
        fatura(6, 1, '2026-06', { kind: 'Fechada' }),
        fatura(9, 1, '2026-09', { kind: 'Aberta' }),
        fatura(11, 1, '2026-11', { kind: 'Aberta' })
      ]
    })
  }

  it('leva a vista e o foco ao título do painel', async () => {
    instalar()
    renderizar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByRole('heading', { name: 'Inter · Setembro de 2026' })

    await usuario.click(screen.getByRole('button', { name: /meses anteriores/ }))
    await usuario.click(screen.getByRole('button', { name: /^Junho de 2026/ }))

    const titulo = await screen.findByRole('heading', { name: 'Inter · Junho de 2026' })
    await waitFor(() => expect(document.activeElement).toBe(titulo))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  // As setas já estão junto do título: rolar até ele a cada mês faria a
  // página pular debaixo do cursor.
  it('navegar pelas setas não rola a página', async () => {
    instalar()
    renderizar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByRole('heading', { name: 'Inter · Setembro de 2026' })

    await usuario.click(screen.getByRole('button', { name: 'Próxima fatura: novembro de 2026' }))
    await screen.findByRole('heading', { name: 'Inter · Novembro de 2026' })

    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})

/**
 * Saindo da fatura corrente — pelas setas ou pelo histórico —, o card do cartão
 * em foco avisava a divergência e não oferecia saída: o caminho de volta era
 * seta por seta, ou sair do cartão e voltar. O clique no card em foco não
 * fazia nada, de propósito, para não descartar a fatura aberta.
 */
describe('FaturasPage — voltar para a fatura corrente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  // Setembro é a fatura corrente; novembro vem pela seta.
  function instalar() {
    return instalarApi([INTER], {
      1: [
        fatura(9, 1, '2026-09', { kind: 'Fechada' }),
        fatura(11, 1, '2026-11', { kind: 'Aberta' })
      ]
    })
  }

  it('com o painel em outra fatura, clicar no cartão em foco volta para a corrente', async () => {
    instalar()
    renderizar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByRole('heading', { name: 'Inter · Setembro de 2026' })
    await usuario.click(screen.getByRole('button', { name: 'Próxima fatura: novembro de 2026' }))
    await screen.findByRole('heading', { name: 'Inter · Novembro de 2026' })

    await usuario.click(within(trilho()).getByRole('button', { name: /^Inter/ }))

    expect(await screen.findByRole('heading', { name: 'Inter · Setembro de 2026' })).toBeTruthy()
  })

  // Sem divergência o clique continua sem efeito: recarregar a fatura que já
  // está na tela descartaria o que estivesse aberto nela.
  it('com o painel na fatura corrente, o clique não recarrega nada', async () => {
    const api = instalar()
    renderizar()
    const usuario = userEvent.setup({ delay: null })
    await screen.findByRole('heading', { name: 'Inter · Setembro de 2026' })
    const leiturasAntes = api.fatura.detalharComParcelas.mock.calls.length

    await usuario.click(within(trilho()).getByRole('button', { name: /^Inter/ }))

    expect(screen.getByRole('heading', { name: 'Inter · Setembro de 2026' })).toBeTruthy()
    expect(api.fatura.detalharComParcelas.mock.calls.length).toBe(leiturasAntes)
  })
})
