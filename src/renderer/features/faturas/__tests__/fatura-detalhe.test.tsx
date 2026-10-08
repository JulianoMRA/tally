// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Despesa } from '@domain/entities/despesa'
import type { StatusFatura } from '@domain/entities/fatura'
import type { PagamentoParcial } from '@domain/entities/pagamento-parcial'
import type { Parcela } from '@domain/entities/parcela'
import type { FaturaDetalhada } from '@shared/ipc/fatura'
import { ToastProvider } from '../../../components/ui'
import { FaturaDetalhe } from '../FaturaDetalhe'

function detalhe(status: StatusFatura, dataVencimento = '2026-10-01'): FaturaDetalhada {
  return {
    fatura: {
      id: 10,
      cartaoId: 1,
      mesReferencia: '2026-09',
      dataFechamento: '2026-09-24',
      dataVencimento,
      status,
      createdAt: '',
      updatedAt: ''
    },
    parcelas: [],
    totalCentavos: 183881,
    pagoParcialCentavos: 0,
    restanteCentavos: 183881,
    excedenteCentavos: 0,
    pagamentosParciais: []
  }
}

function renderizar(d: FaturaDetalhada) {
  vi.stubGlobal(
    'window',
    Object.assign(window, { api: { categoria: { list: vi.fn().mockResolvedValue([]) } } })
  )
  render(
    <ToastProvider>
      <FaturaDetalhe detalhe={d} cartaoNome="Inter" cartaoCor="#f70" onAtualizada={() => {}} />
    </ToastProvider>
  )
}

/** Hoje fixo em 29/09/2026; só o `Date` é falso. */
describe('FaturaDetalhe — prazo e pagamento no resumo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('fatura Fechada perto do vencimento avisa, em tom de atenção', () => {
    renderizar(detalhe({ kind: 'Fechada' }))

    expect(screen.getByText('vence em 2 dias').getAttribute('data-tom')).toBe('atencao')
  })

  it('fatura vencida avisa em tom de alerta', () => {
    renderizar(detalhe({ kind: 'Fechada' }, '2026-09-10'))

    expect(screen.getByText('vencida há 19 dias').getAttribute('data-tom')).toBe('alerta')
  })

  // O `pagaEm` era gravado e não aparecia em lugar nenhum: a fatura paga não
  // dizia quando foi paga.
  it('fatura paga diz quando foi paga', () => {
    renderizar(detalhe({ kind: 'Paga', pagaEm: '2026-09-20' }))

    expect(screen.getByText('Paga em 20/09/2026')).toBeTruthy()
  })
})

function despesa(over: Partial<Despesa> = {}): Despesa {
  return {
    id: 5,
    descricao: 'Notebook',
    categoriaId: 1,
    tipo: 'Parcelada',
    formaPagamento: 'Credito',
    cartaoId: 1,
    valorCentavos: 300000,
    totalParcelas: 3,
    dataCompra: '2026-08-20',
    diaCobranca: null,
    recorreAte: null,
    nota: null,
    ativa: true,
    createdAt: '',
    updatedAt: '',
    ...over
  }
}

function parcela(over: Partial<Parcela> = {}): Parcela {
  return {
    id: 50,
    despesaId: 5,
    faturaId: 10,
    numero: 2,
    total: 3,
    valorCentavos: 100000,
    dataReferencia: '2026-09-01',
    status: 'Pendente',
    dataPagamento: null,
    createdAt: '',
    updatedAt: '',
    ...over
  }
}

function comParcela(
  status: StatusFatura,
  d: Despesa,
  p: Parcela,
  extra: Partial<FaturaDetalhada> = {}
): FaturaDetalhada {
  return {
    ...detalhe(status),
    parcelas: [p],
    totalCentavos: p.valorCentavos,
    restanteCentavos: p.valorCentavos,
    despesasPorParcela: { [p.id]: d },
    ...extra
  }
}

type ApiExtra = Record<string, Record<string, unknown>>

/**
 * `onAtualizada` é o pedido de recarga que o componente faz à página depois de
 * uma ação. Ele lia o detalhe por conta própria e ainda avisava a página por
 * dois callbacks, que reliam a mesma coisa: três leituras por ação.
 */
function renderizarCom(
  d: FaturaDetalhada,
  api: ApiExtra = {},
  onAtualizada: () => void = () => {}
) {
  vi.stubGlobal(
    'window',
    Object.assign(window, {
      api: { categoria: { list: vi.fn().mockResolvedValue([]) }, ...api }
    })
  )
  render(
    <ToastProvider>
      <FaturaDetalhe detalhe={d} cartaoNome="Inter" cartaoCor="#f70" onAtualizada={onAtualizada} />
    </ToastProvider>
  )
}

async function itemDoMenu(rotulo: string) {
  const usuario = userEvent.setup()
  await usuario.click(screen.getByRole('button', { name: /^Mais ações/ }))
  return within(screen.getByRole('menu')).getByRole('menuitem', { name: rotulo })
}

// RF-DES-09 — a tela oferecia Excluir em toda parcela pendente e só descobria
// o bloqueio depois do diálogo "irreversível".
describe('FaturaDetalhe — Excluir', () => {
  afterEach(cleanup)

  it('fica desabilitado quando a exclusão está bloqueada, com o motivo', async () => {
    renderizarCom(
      comParcela({ kind: 'Aberta' }, despesa(), parcela(), {
        exclusaoBloqueada: { 5: 'has-parcela-em-fatura-fechada' }
      })
    )

    const excluir = await itemDoMenu('Excluir')
    expect((excluir as HTMLButtonElement).disabled).toBe(true)
    expect(excluir.getAttribute('title')).toMatch(/fatura fechada/)
  })

  it('segue habilitado quando nada bloqueia', async () => {
    renderizarCom(comParcela({ kind: 'Aberta' }, despesa(), parcela(), { exclusaoBloqueada: {} }))

    const excluir = await itemDoMenu('Excluir')
    expect((excluir as HTMLButtonElement).disabled).toBe(false)
  })
})

/**
 * RF-DES-09 — o diálogo era genérico ("A despesa e TODAS as suas parcelas
 * pendentes serão removidas"), numa tabela densa e para uma ação irreversível.
 * O de excluir pagamento parcial, mais novo, já repetia valor e data.
 */
describe('FaturaDetalhe — confirmar a exclusão da despesa', () => {
  afterEach(cleanup)

  async function abrirConfirmacao(d: Despesa, p: Parcela, api: ApiExtra = {}) {
    renderizarCom(comParcela({ kind: 'Aberta' }, d, p, { exclusaoBloqueada: {} }), api)
    const usuario = userEvent.setup()
    await usuario.click(await itemDoMenu('Excluir'))
    return { usuario, dialogo: screen.getByRole('dialog', { name: 'Excluir despesa?' }) }
  }

  it('compra à vista: nomeia a despesa e o valor', async () => {
    const { dialogo } = await abrirConfirmacao(
      despesa({ descricao: 'Mercado', tipo: 'Unica', totalParcelas: null, valorCentavos: 7500 }),
      parcela({ numero: 1, total: 1, valorCentavos: 7500 })
    )

    expect(dialogo.textContent).toMatch(/Mercado, R\$\s*75,00\. Esta ação é irreversível\./)
    expect(dialogo.textContent).not.toMatch(/TODAS/)
  })

  it('parcelada: o valor da compra e em quantas parcelas', async () => {
    const { dialogo } = await abrirConfirmacao(despesa(), parcela())

    expect(dialogo.textContent).toMatch(/Notebook, R\$\s*3\.000,00 em 3 parcelas\./)
    expect(dialogo.textContent).toMatch(/Todas as parcelas dela serão removidas\./)
  })

  it('assinatura: o valor por mês', async () => {
    const { dialogo } = await abrirConfirmacao(
      despesa({
        descricao: 'iCloud+',
        tipo: 'Assinatura',
        totalParcelas: null,
        valorCentavos: 1290
      }),
      parcela({ numero: 31, total: null, valorCentavos: 1290 })
    )

    expect(dialogo.textContent).toMatch(/iCloud\+, R\$\s*12,90 por mês\./)
    expect(dialogo.textContent).toMatch(/Todas as ocorrências dela serão removidas\./)
  })

  it('confirmar exclui a despesa da linha', async () => {
    const excluir = vi.fn().mockResolvedValue(undefined)
    const { usuario, dialogo } = await abrirConfirmacao(despesa(), parcela(), {
      despesa: { excluir }
    })

    await usuario.click(within(dialogo).getByRole('button', { name: 'Excluir' }))

    expect(excluir).toHaveBeenCalledWith({ despesaId: 5 })
  })
})

// RF-DES-10 — numa fatura Fechada, a compra à vista não aceita valor nem data
// novos; o modal deixava editar e a gravação era recusada.
describe('FaturaDetalhe — editar compra à vista em fatura fechada', () => {
  afterEach(cleanup)

  it('abre o modal com valor e data travados', async () => {
    const aVista = despesa({ tipo: 'Unica', totalParcelas: 1, valorCentavos: 5000 })
    renderizarCom(comParcela({ kind: 'Fechada' }, aVista, parcela({ numero: 1, total: 1 })))
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Editar' }))

    const modal = screen.getByRole('dialog', { name: 'Editar despesa' })
    expect((within(modal).getByLabelText('Valor (R$)') as HTMLInputElement).disabled).toBe(true)
    expect((within(modal).getByLabelText('Data da compra') as HTMLInputElement).disabled).toBe(true)
  })

  it('numa fatura Aberta, valor e data seguem editáveis', async () => {
    const aVista = despesa({ tipo: 'Unica', totalParcelas: 1, valorCentavos: 5000 })
    renderizarCom(comParcela({ kind: 'Aberta' }, aVista, parcela({ numero: 1, total: 1 })))
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Editar' }))

    const modal = screen.getByRole('dialog', { name: 'Editar despesa' })
    expect((within(modal).getByLabelText('Valor (R$)') as HTMLInputElement).disabled).toBe(false)
  })
})

describe('FaturaDetalhe — ciclo da fatura', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  // RF-FAT-04 — era um formulário inline, o único passo do ciclo fora de um
  // diálogo. O erro fica no diálogo, legível, e ele só fecha quando dá certo.
  it('marcar como paga abre um diálogo; o erro fica nele, sem o prefixo do Electron', async () => {
    const pagar = vi
      .fn()
      .mockRejectedValue(
        new Error("Error invoking remote method 'fatura:pagar': Error: Fatura já está paga.")
      )
    renderizarCom(detalhe({ kind: 'Fechada' }), { fatura: { pagar } })
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Marcar como paga' }))
    const dialogo = screen.getByRole('dialog', { name: 'Marcar fatura como paga' })
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar pagamento' }))

    expect(pagar).toHaveBeenCalledWith(10, '2026-09-29')
    expect(await within(dialogo).findByText('Fatura já está paga.')).toBeTruthy()
    expect(screen.queryByText(/Error invoking/)).toBeNull()
  })

  it('pago com sucesso, o diálogo fecha', async () => {
    const pagar = vi.fn().mockResolvedValue({
      ...detalhe({ kind: 'Fechada' }).fatura,
      status: { kind: 'Paga', pagaEm: '2026-09-29' }
    })
    renderizarCom(detalhe({ kind: 'Fechada' }), { fatura: { pagar } })
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Marcar como paga' }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))

    await vi.waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Marcar fatura como paga' })).toBeNull()
    )
  })

  // O texto dizia que "novas parcelas só entram via adiantamento" — mas fatura
  // Fechada recusa justamente o adiantamento (RN-06).
  it('o diálogo de fechar diz o que o fechamento trava', async () => {
    renderizarCom(detalhe({ kind: 'Aberta' }))
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Fechar fatura' }))

    const texto = screen.getByRole('dialog', { name: 'Fechar fatura?' }).textContent ?? ''
    expect(texto).not.toMatch(/só entram via adiantamento/)
    expect(texto).toMatch(/não recebe mais adiantamentos/)
  })

  // RN-06 — "Fechar" ao lado de "Cancelar" se lia como fechar o diálogo, e a
  // janela já tem um botão com esse nome. E fechar à mão não tem desfazer
  // direto: só fatura paga reabre (RF-FAT-05).
  it('o diálogo de fechar confirma por "Fechar fatura" e diz como voltar atrás', async () => {
    const fechar = vi.fn().mockResolvedValue({
      ...detalhe({ kind: 'Aberta' }).fatura,
      status: { kind: 'Fechada' }
    })
    renderizarCom(detalhe({ kind: 'Aberta' }), { fatura: { fechar } })
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Fechar fatura' }))
    const dialogo = screen.getByRole('dialog', { name: 'Fechar fatura?' })
    expect(within(dialogo).queryByRole('button', { name: 'Fechar' })).toBeNull()
    expect(dialogo.textContent).toMatch(/marque como paga e depois reabra/)

    await usuario.click(within(dialogo).getByRole('button', { name: 'Fechar fatura' }))

    expect(fechar).toHaveBeenCalledWith(10)
  })
})

// RN-03 — o aviso repetia a quantidade pedida, mesmo quando o main movia menos.
describe('FaturaDetalhe — aviso do adiantamento', () => {
  afterEach(cleanup)

  async function adiantar(movidas: number, quantidade: string) {
    const adiantarParcelas = vi.fn().mockResolvedValue({
      movidas: Array.from({ length: movidas }, (_, i) => ({ id: i })),
      faturasAfetadas: []
    })
    renderizarCom(comParcela({ kind: 'Aberta' }, despesa(), parcela()), {
      despesa: { adiantarParcelas },
      fatura: {
        listarPorCartao: vi.fn().mockResolvedValue([detalhe({ kind: 'Aberta' }).fatura])
      }
    })
    const usuario = userEvent.setup()
    await usuario.click(await itemDoMenu('Adiantar'))
    const modal = screen.getByRole('dialog', { name: 'Adiantar parcelas' })
    await vi.waitFor(() =>
      expect((within(modal).getByLabelText('Fatura destino') as HTMLSelectElement).disabled).toBe(
        false
      )
    )
    const campo = within(modal).getByLabelText('Quantidade de parcelas')
    await usuario.clear(campo)
    await usuario.type(campo, quantidade)
    await usuario.click(within(modal).getByRole('button', { name: 'Confirmar' }))
  }

  it('conta as parcelas que o main moveu, não as pedidas', async () => {
    await adiantar(2, '3')

    expect(await screen.findByText('2 de 3 parcelas adiantadas.')).toBeTruthy()
  })

  it('sem nada movido, diz que não havia o que adiantar', async () => {
    await adiantar(0, '1')

    expect(await screen.findByText('Nenhuma parcela para adiantar para esta fatura.')).toBeTruthy()
  })
})

// RF-FAT-03/06 — o resumo era um card lateral; na janela padrão ele caía para
// baixo das parcelas, com o total e "Marcar como paga" depois de 36 linhas.
describe('FaturaDetalhe — faixa de resumo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('traz status, datas, total e a ação, antes das parcelas', () => {
    renderizarCom(comParcela({ kind: 'Fechada' }, despesa(), parcela()))

    const faixa = screen.getByRole('region', { name: 'Resumo da fatura' })
    expect(within(faixa).getByText('Fechada')).toBeTruthy()
    expect(within(faixa).getByText('24/09/2026')).toBeTruthy()
    expect(within(faixa).getByText('01/10/2026')).toBeTruthy()
    expect(within(faixa).getByText('Total da fatura')).toBeTruthy()
    expect(within(faixa).getByRole('button', { name: 'Marcar como paga' })).toBeTruthy()

    const tabela = screen.getByRole('table')
    expect(faixa.compareDocumentPosition(tabela) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // O título já diz o mês; a linha "Mês" repetia.
  it('não repete o mês numa linha própria', () => {
    renderizarCom(comParcela({ kind: 'Fechada' }, despesa(), parcela()))

    expect(screen.queryByText('Mês', { exact: true })).toBeNull()
  })

  // O total aparecia no card do trilho, na meta do painel e no resumo.
  it('a meta das parcelas conta os lançamentos sem repetir o total', () => {
    renderizarCom(comParcela({ kind: 'Fechada' }, despesa(), parcela()))

    const meta = screen.getByText('1 lançamento')
    expect(meta.textContent).not.toMatch(/R\$/)
  })
})

// RF-FAT-03, RF-DES-14 — o painel se chamava "Parcelas", contava "lançamentos"
// e listava compras à vista. Em Saídas a mesma lista se chama "Lançamentos".
describe('FaturaDetalhe — painel de lançamentos', () => {
  afterEach(cleanup)

  it('se chama Lançamentos, como em Saídas', () => {
    renderizarCom(comParcela({ kind: 'Aberta' }, despesa(), parcela()))

    expect(screen.getByRole('heading', { name: 'Lançamentos' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Parcelas' })).toBeNull()
  })

  it('sem lançamento, o vazio fala em lançamento, e não em parcela', () => {
    renderizarCom(detalhe({ kind: 'Aberta' }))

    expect(screen.getByText('Nenhum lançamento nesta fatura.')).toBeTruthy()
  })
})

// As setas eram texto solto nas pontas da largura inteira, acima do título que
// elas mudam; "← sem anterior" era um botão desabilitado com texto.
describe('FaturaDetalhe — navegação junto do título', () => {
  afterEach(cleanup)

  it('as setas nomeiam a fatura para onde levam', async () => {
    const anterior = vi.fn()
    const proxima = vi.fn()
    vi.stubGlobal(
      'window',
      Object.assign(window, { api: { categoria: { list: vi.fn().mockResolvedValue([]) } } })
    )
    render(
      <ToastProvider>
        <FaturaDetalhe
          detalhe={detalhe({ kind: 'Aberta' })}
          cartaoNome="Inter"
          cartaoCor="#f70"
          anterior={{ mesReferencia: '2026-08', abrir: anterior }}
          proxima={{ mesReferencia: '2026-10', abrir: proxima }}
          onAtualizada={() => {}}
        />
      </ToastProvider>
    )
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Fatura anterior: agosto de 2026' }))
    await usuario.click(screen.getByRole('button', { name: 'Próxima fatura: outubro de 2026' }))

    expect(anterior).toHaveBeenCalledTimes(1)
    expect(proxima).toHaveBeenCalledTimes(1)
  })

  it('sem vizinha, a seta fica desabilitada', () => {
    renderizarCom(detalhe({ kind: 'Aberta' }))

    const semAnterior = screen.getByRole('button', { name: 'Sem fatura anterior' })
    expect((semAnterior as HTMLButtonElement).disabled).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Sem próxima fatura' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })

  // A "próxima" vinha depois do título, que muda de largura com o nome do mês:
  // de fevereiro para março ela andava mais que a largura do próprio botão, e o
  // clique seguinte caía fora dela.
  it('as duas setas vêm juntas, antes do título', () => {
    renderizarCom(detalhe({ kind: 'Aberta' }))

    const anterior = screen.getByRole('button', { name: 'Sem fatura anterior' })
    const proxima = screen.getByRole('button', { name: 'Sem próxima fatura' })
    const titulo = screen.getByRole('heading', { level: 2 })
    const segue = Node.DOCUMENT_POSITION_FOLLOWING
    expect(anterior.compareDocumentPosition(proxima) & segue).toBeTruthy()
    expect(proxima.compareDocumentPosition(titulo) & segue).toBeTruthy()
  })
})

/**
 * A tabela de parcelas com o vocabulário e a hierarquia da lista de Saídas
 * (RF-DES-14): a mesma parcela tinha um nome em cada tela.
 */
describe('FaturaDetalhe — tabela de parcelas', () => {
  afterEach(cleanup)

  const ocorrencia = (rotuloParcela: string, origemCentavos: number | null = null) => ({
    impactoCentavos: 100000,
    origemCentavos,
    rotuloParcela,
    progressoPct: null
  })

  function linhaDe(descricao: string) {
    return screen.getByRole('row', { name: new RegExp(descricao) })
  }

  // Toda parcela de uma fatura tem o status dela: a coluna repetia "Pendente"
  // em todas as linhas, e ordenar por ela não mudava nada.
  it('tem as colunas de Saídas, sem Status', () => {
    renderizarCom(comParcela({ kind: 'Aberta' }, despesa(), parcela()))

    for (const nome of [/Descrição/, /Categoria/, /Compra/, /Parcela/, /Valor/, /Ações/]) {
      expect(screen.getByRole('columnheader', { name: nome })).toBeTruthy()
    }
    expect(screen.queryByRole('columnheader', { name: /Status/ })).toBeNull()
    expect(screen.queryByText('Pendente')).toBeNull()
  })

  it('compra à vista diz "à vista", em tom de apoio, e não "1/1"', () => {
    const aVista = despesa({ tipo: 'Unica', totalParcelas: 1, valorCentavos: 5000 })
    const p = parcela({ numero: 1, total: 1 })
    renderizarCom(
      comParcela({ kind: 'Aberta' }, aVista, p, {
        ocorrenciaPorParcela: { [p.id]: ocorrencia('à vista') }
      })
    )

    expect(screen.getByText('à vista').getAttribute('data-tom')).toBe('apoio')
    expect(screen.queryByText('1/1')).toBeNull()
  })

  it('parcelada mostra o número e o valor da compra', () => {
    const p = parcela()
    renderizarCom(
      comParcela({ kind: 'Aberta' }, despesa(), p, {
        ocorrenciaPorParcela: { [p.id]: ocorrencia('2/3', 300000) }
      })
    )

    const linha = linhaDe('Notebook')
    expect(within(linha).getByText('2/3').getAttribute('data-tom')).toBeNull()
    expect(within(linha).getByText(/de R\$\s*3\.000,00/)).toBeTruthy()
  })

  // A data da assinatura era a de referência, sempre dia 01: um dia inventado.
  // E o selo ASSINATURA repetia o que "mensal" já diz.
  it('assinatura diz "mensal" e "desde MM/AAAA", sem o selo nem o dia inventado', () => {
    const assinatura = despesa({
      descricao: 'iCloud+',
      tipo: 'Assinatura',
      totalParcelas: null,
      dataCompra: '2024-03-10'
    })
    const p = parcela({ numero: 31, total: null, dataReferencia: '2026-09-01' })
    renderizarCom(
      comParcela({ kind: 'Aberta' }, assinatura, p, {
        ocorrenciaPorParcela: { [p.id]: ocorrencia('mensal') }
      })
    )

    const linha = linhaDe('iCloud')
    expect(within(linha).getByText('mensal')).toBeTruthy()
    expect(within(linha).getByText('desde 03/2024')).toBeTruthy()
    expect(within(linha).queryByText('Assinatura')).toBeNull()
    expect(within(linha).queryByText('01/09/2026')).toBeNull()
  })

  it('mostra a categoria da despesa, com o selo quando está arquivada', async () => {
    const casa = {
      id: 1,
      nome: 'Casa',
      cor: '#3f6e47',
      ativo: false,
      createdAt: '',
      updatedAt: ''
    }
    renderizarCom(comParcela({ kind: 'Aberta' }, despesa(), parcela()), {
      categoria: { list: vi.fn().mockResolvedValue([casa]) }
    })

    const linha = linhaDe('Notebook')
    expect(await within(linha).findByText('Casa')).toBeTruthy()
    expect(within(linha).getByText('Arquivada')).toBeTruthy()
  })

  // O "Editar" da assinatura ficava desabilitado ("se editam na tela Saídas"),
  // mas o modal de assinatura é compartilhado e funciona daqui.
  it('Editar de assinatura abre o modal de assinatura', async () => {
    const assinatura = despesa({ descricao: 'iCloud+', tipo: 'Assinatura', totalParcelas: null })
    renderizarCom(comParcela({ kind: 'Aberta' }, assinatura, parcela({ numero: 31, total: null })))
    const usuario = userEvent.setup()

    const editar = screen.getByRole('button', { name: 'Editar' }) as HTMLButtonElement
    expect(editar.disabled).toBe(false)
    await usuario.click(editar)

    expect(screen.getByRole('dialog', { name: 'Editar assinatura' })).toBeTruthy()
  })

  describe('ordenação', () => {
    function doisLancamentos(): FaturaDetalhada {
      const cedo = despesa({ id: 5, descricao: 'Mercado', dataCompra: '2026-08-10' })
      const tarde = despesa({ id: 6, descricao: 'Farmácia', dataCompra: '2026-08-20' })
      const pCedo = parcela({ id: 50, despesaId: 5, valorCentavos: 90000 })
      const pTarde = parcela({ id: 51, despesaId: 6, valorCentavos: 20000 })
      return {
        ...detalhe({ kind: 'Aberta' }),
        parcelas: [pTarde, pCedo],
        totalCentavos: 110000,
        restanteCentavos: 110000,
        despesasPorParcela: { 50: cedo, 51: tarde }
      }
    }

    function descricoes(): string[] {
      return screen
        .getAllByRole('row')
        .slice(1)
        .map((linha) => within(linha).getAllByRole('cell')[0]?.textContent ?? '')
    }

    // A ordem do extrato do banco: da compra mais antiga para a mais nova.
    it('abre pela data da compra, crescente', () => {
      renderizarCom(doisLancamentos())

      expect(descricoes()).toEqual(['Mercado', 'Farmácia'])
      expect(screen.getByRole('columnheader', { name: /Compra/ }).getAttribute('aria-sort')).toBe(
        'ascending'
      )
    })

    it('ordena por Valor no clique do cabeçalho', async () => {
      renderizarCom(doisLancamentos())
      const usuario = userEvent.setup()

      await usuario.click(screen.getByRole('button', { name: 'Valor' }))

      expect(descricoes()).toEqual(['Farmácia', 'Mercado'])
    })

    // "à vista", "mensal" e "1/6" não têm ordem natural.
    it('Parcela não é ordenável', () => {
      renderizarCom(doisLancamentos())

      const parcelaTh = screen.getByRole('columnheader', { name: /Parcela/ })
      expect(within(parcelaTh).queryByRole('button')).toBeNull()
    })
  })
})

function pagamento(over: Partial<PagamentoParcial> = {}): PagamentoParcial {
  return {
    id: 70,
    faturaId: 10,
    valorCentavos: 20000,
    dataPagamento: '2026-09-10',
    createdAt: '',
    updatedAt: '',
    ...over
  }
}

/** Fatura de R$ 800,00 (ou do total dado) com os pagamentos parciais dados. */
function comParciais(
  status: StatusFatura,
  pagamentos: PagamentoParcial[] = [pagamento()],
  totalCentavos = 80000
): FaturaDetalhada {
  const pago = pagamentos.reduce((soma, p) => soma + p.valorCentavos, 0)
  return {
    ...detalhe(status),
    totalCentavos,
    pagoParcialCentavos: pago,
    restanteCentavos: Math.max(0, totalCentavos - pago),
    excedenteCentavos: Math.max(0, pago - totalCentavos),
    pagamentosParciais: pagamentos
  }
}

/**
 * RF-FAT-07 e RN-10 no painel da fatura: registrar e excluir pagamento parcial,
 * e a faixa passando a dizer o que falta pagar.
 *
 * Hoje fixo em 29/09/2026; a fatura dos dublês fecha em 24/09 e vence em 01/10.
 */
describe('FaturaDetalhe — pagamento parcial', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  function faixa() {
    return screen.getByRole('region', { name: 'Resumo da fatura' })
  }

  function painel() {
    return screen.getByRole('region', { name: 'Pagamentos parciais' })
  }

  /** O valor ao lado de um rótulo da faixa ("Falta pagar" → "R$ 600,00"). */
  function valorDe(rotulo: string): string {
    return within(faixa()).getByText(rotulo).parentElement?.textContent ?? ''
  }

  async function abrirMenuDoPagamento() {
    const usuario = userEvent.setup({ delay: null })
    await usuario.click(within(painel()).getByRole('button', { name: /^Mais ações/ }))
    return usuario
  }

  describe('botão', () => {
    it.each([{ kind: 'Aberta' }, { kind: 'Fechada' }] as const)(
      'fatura $kind oferece "Registrar pagamento parcial"',
      (status) => {
        renderizarCom(comParciais(status, []))

        const botao = within(faixa()).getByRole('button', { name: 'Registrar pagamento parcial' })
        expect((botao as HTMLButtonElement).disabled).toBe(false)
      }
    )

    // Fatura paga é imutável (RF-FAT-04): quem quer registrar algo nela reabre.
    it('fatura Paga não oferece', () => {
      renderizarCom(comParciais({ kind: 'Paga', pagaEm: '2026-09-20' }, []))

      expect(screen.queryByRole('button', { name: 'Registrar pagamento parcial' })).toBeNull()
    })

    // Sem nada a pagar não existe valor aceitável: oferecer o diálogo seria
    // oferecer uma ação que a tela sabe que vai falhar.
    it('sem nada a pagar, fica desabilitado e diz por quê', () => {
      renderizarCom(comParciais({ kind: 'Aberta' }, [], 0))

      const botao = within(faixa()).getByRole('button', { name: 'Registrar pagamento parcial' })
      expect((botao as HTMLButtonElement).disabled).toBe(true)
      expect(botao.getAttribute('title')).toMatch(/Não falta nada a pagar/)
    })
  })

  describe('faixa de resumo', () => {
    it('sem parcial, segue só com o total', () => {
      renderizarCom(comParciais({ kind: 'Aberta' }, []))

      expect(valorDe('Total da fatura')).toMatch(/R\$\s*800,00/)
      expect(within(faixa()).queryByText('Falta pagar')).toBeNull()
      expect(within(faixa()).queryByText('Pagamentos parciais')).toBeNull()
      expect(screen.queryByRole('region', { name: 'Pagamentos parciais' })).toBeNull()
    })

    it('com parcial, mostra o total, o que foi pago e o que falta', () => {
      renderizarCom(comParciais({ kind: 'Aberta' }))

      expect(valorDe('Total da fatura')).toMatch(/R\$\s*800,00/)
      expect(valorDe('Pagamentos parciais')).toMatch(/R\$\s*200,00/)
      expect(valorDe('Falta pagar')).toMatch(/R\$\s*600,00/)
    })

    // "Falta pagar" numa fatura paga seria falso: o restante já foi pago.
    it('fatura Paga com parcial diz "Restante pago", e não "Falta pagar"', () => {
      renderizarCom(comParciais({ kind: 'Paga', pagaEm: '2026-09-20' }))

      expect(valorDe('Restante pago')).toMatch(/R\$\s*600,00/)
      expect(within(faixa()).queryByText('Falta pagar')).toBeNull()
    })

    // Só acontece quando uma despesa é excluída ou reduzida depois do
    // pagamento. A faixa diz quanto, para o pagamento poder ser corrigido.
    it('pago a mais aparece na faixa, em tom de atenção', () => {
      renderizarCom(comParciais({ kind: 'Aberta' }, [pagamento({ valorCentavos: 50000 })], 10000))

      const aviso = within(faixa()).getByText(/R\$\s*400,00 pagos a mais/)
      expect(aviso.getAttribute('data-tom')).toBe('atencao')
      expect(valorDe('Falta pagar')).toMatch(/R\$\s*0,00/)
    })

    // A dois dias do vencimento ela diria "vence em 2 dias". Com tudo pago em
    // parciais não há o que pagar, só o que marcar.
    it('fatura Fechada quitada por parciais não mostra aviso de prazo', () => {
      renderizarCom(comParciais({ kind: 'Fechada' }, [pagamento({ valorCentavos: 80000 })]))

      expect(within(faixa()).queryByText(/vence em|vencida há/)).toBeNull()
      expect(within(faixa()).getByRole('button', { name: 'Marcar como paga' })).toBeTruthy()
    })
  })

  describe('lista de pagamentos', () => {
    it('lista cada pagamento com data e valor, entre a faixa e as parcelas', () => {
      renderizarCom(
        comParciais({ kind: 'Aberta' }, [
          pagamento({ id: 70, valorCentavos: 20000, dataPagamento: '2026-09-10' }),
          pagamento({ id: 71, valorCentavos: 15050, dataPagamento: '2026-09-18' })
        ])
      )

      const linhas = within(painel()).getAllByRole('row').slice(1)
      expect(linhas).toHaveLength(2)
      expect(within(linhas[0]!).getByText('10/09/2026')).toBeTruthy()
      expect(within(linhas[0]!).getByText(/^R\$\s*200,00$/)).toBeTruthy()
      expect(within(linhas[1]!).getByText('18/09/2026')).toBeTruthy()
      expect(within(linhas[1]!).getByText(/^R\$\s*150,50$/)).toBeTruthy()

      const antes = Node.DOCUMENT_POSITION_FOLLOWING
      expect(faixa().compareDocumentPosition(painel()) & antes).toBeTruthy()
      expect(
        painel().compareDocumentPosition(screen.getByRole('heading', { name: 'Lançamentos' })) &
          antes
      ).toBeTruthy()
    })

    // A soma já está na faixa: repeti-la aqui seria o mesmo número duas vezes
    // a poucos centímetros um do outro.
    it('a meta conta os pagamentos, sem repetir a soma', () => {
      renderizarCom(comParciais({ kind: 'Aberta' }, [pagamento({ id: 70 }), pagamento({ id: 71 })]))

      expect(within(painel()).getByText('2 pagamentos')).toBeTruthy()
    })
  })

  describe('registrar', () => {
    it('chama o main com a fatura, o valor e a data, avisa e pede a recarga', async () => {
      const registrarPagamentoParcial = vi.fn().mockResolvedValue(pagamento())
      const onAtualizada = vi.fn()
      renderizarCom(
        comParciais({ kind: 'Aberta' }, []),
        { fatura: { registrarPagamentoParcial } },
        onAtualizada
      )
      const usuario = userEvent.setup({ delay: null })

      await usuario.click(screen.getByRole('button', { name: 'Registrar pagamento parcial' }))
      const dialogo = screen.getByRole('dialog', { name: 'Registrar pagamento parcial' })
      await usuario.type(within(dialogo).getByLabelText('Valor (R$)'), '200,00')
      await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar pagamento' }))

      expect(registrarPagamentoParcial).toHaveBeenCalledWith({
        faturaId: 10,
        valorCentavos: 20000,
        dataPagamento: '2026-09-29'
      })
      expect(await screen.findByText('Pagamento parcial registrado.')).toBeTruthy()
      expect(screen.queryByRole('dialog', { name: 'Registrar pagamento parcial' })).toBeNull()
      expect(onAtualizada).toHaveBeenCalledTimes(1)
    })

    it('o diálogo conhece o que falta pagar, descontados os parciais', async () => {
      renderizarCom(comParciais({ kind: 'Aberta' }))
      const usuario = userEvent.setup({ delay: null })

      await usuario.click(screen.getByRole('button', { name: 'Registrar pagamento parcial' }))

      const dialogo = screen.getByRole('dialog', { name: 'Registrar pagamento parcial' })
      expect(dialogo.textContent).toMatch(/falta pagar R\$\s*600,00/)
    })

    it('o erro do main fica no diálogo, que não fecha', async () => {
      const registrarPagamentoParcial = vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Error invoking remote method 'fatura:registrarPagamentoParcial': Error: Fatura já está paga. Reabra a fatura antes de registrar um pagamento parcial."
          )
        )
      renderizarCom(comParciais({ kind: 'Aberta' }, []), { fatura: { registrarPagamentoParcial } })
      const usuario = userEvent.setup({ delay: null })

      await usuario.click(screen.getByRole('button', { name: 'Registrar pagamento parcial' }))
      const dialogo = screen.getByRole('dialog', { name: 'Registrar pagamento parcial' })
      await usuario.type(within(dialogo).getByLabelText('Valor (R$)'), '200,00')
      await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar pagamento' }))

      expect(await within(dialogo).findByText(/Reabra a fatura/)).toBeTruthy()
      expect(dialogo.textContent).not.toMatch(/Error invoking/)
      expect(screen.queryByText('Pagamento parcial registrado.')).toBeNull()
    })
  })

  describe('excluir', () => {
    it('pede confirmação com o valor e a data, e só então chama o main', async () => {
      const excluirPagamentoParcial = vi.fn().mockResolvedValue(undefined)
      const onAtualizada = vi.fn()
      renderizarCom(
        comParciais({ kind: 'Aberta' }),
        { fatura: { excluirPagamentoParcial } },
        onAtualizada
      )

      const usuario = await abrirMenuDoPagamento()
      await usuario.click(
        within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Excluir' })
      )

      const confirmacao = screen.getByRole('dialog', { name: 'Excluir pagamento parcial?' })
      expect(confirmacao.textContent).toMatch(/R\$\s*200,00/)
      expect(confirmacao.textContent).toMatch(/10\/09\/2026/)
      expect(excluirPagamentoParcial).not.toHaveBeenCalled()

      await usuario.click(within(confirmacao).getByRole('button', { name: 'Excluir' }))

      expect(excluirPagamentoParcial).toHaveBeenCalledWith({ pagamentoId: 70 })
      expect(await screen.findByText('Pagamento parcial excluído.')).toBeTruthy()
      expect(onAtualizada).toHaveBeenCalledTimes(1)
    })

    it('cancelar a confirmação não chama o main', async () => {
      const excluirPagamentoParcial = vi.fn()
      renderizarCom(comParciais({ kind: 'Aberta' }), { fatura: { excluirPagamentoParcial } })

      const usuario = await abrirMenuDoPagamento()
      await usuario.click(
        within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Excluir' })
      )
      const confirmacao = screen.getByRole('dialog', { name: 'Excluir pagamento parcial?' })
      await usuario.click(within(confirmacao).getByRole('button', { name: 'Cancelar' }))

      expect(excluirPagamentoParcial).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog', { name: 'Excluir pagamento parcial?' })).toBeNull()
    })

    // Como o Excluir da despesa (RF-DES-09): desabilitado com o motivo, em vez
    // de abrir o diálogo "irreversível" e falhar depois.
    it('em fatura Paga, fica desabilitado e diz por quê', async () => {
      renderizarCom(comParciais({ kind: 'Paga', pagaEm: '2026-09-20' }))

      await abrirMenuDoPagamento()

      const excluir = within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Excluir' })
      expect((excluir as HTMLButtonElement).disabled).toBe(true)
      expect(excluir.getAttribute('title')).toMatch(/Reabra a fatura/)
    })

    it('a falha do main vira aviso legível', async () => {
      const excluirPagamentoParcial = vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Error invoking remote method 'fatura:excluirPagamentoParcial': Error: Pagamento parcial #70 não encontrado"
          )
        )
      renderizarCom(comParciais({ kind: 'Aberta' }), { fatura: { excluirPagamentoParcial } })

      const usuario = await abrirMenuDoPagamento()
      await usuario.click(
        within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Excluir' })
      )
      await usuario.click(
        within(screen.getByRole('dialog', { name: 'Excluir pagamento parcial?' })).getByRole(
          'button',
          { name: 'Excluir' }
        )
      )

      expect(await screen.findByText('Pagamento parcial #70 não encontrado')).toBeTruthy()
      expect(screen.queryByText(/Error invoking/)).toBeNull()
    })
  })

  describe('ciclo da fatura com parcial', () => {
    // O que se paga em "Marcar como paga" é o restante.
    it('o diálogo de pagar diz o que falta e o que já foi pago', async () => {
      renderizarCom(comParciais({ kind: 'Fechada' }))
      const usuario = userEvent.setup({ delay: null })

      await usuario.click(screen.getByRole('button', { name: 'Marcar como paga' }))

      const texto = screen.getByRole('dialog', { name: 'Marcar fatura como paga' }).textContent
      expect(texto).toMatch(/falta pagar R\$\s*600,00 de R\$\s*800,00/)
      expect(texto).toMatch(/R\$\s*200,00 já pagos/)
    })

    it('o diálogo de reabrir avisa que os pagamentos parciais são mantidos', async () => {
      renderizarCom(comParciais({ kind: 'Paga', pagaEm: '2026-09-20' }))
      const usuario = userEvent.setup({ delay: null })

      await usuario.click(screen.getByRole('button', { name: 'Reabrir fatura' }))

      const texto = screen.getByRole('dialog', { name: 'Reabrir fatura?' }).textContent
      expect(texto).toMatch(/pagamentos parciais são mantidos/)
    })

    it('sem parcial, o diálogo de reabrir não fala em pagamento parcial', async () => {
      renderizarCom(comParciais({ kind: 'Paga', pagaEm: '2026-09-20' }, []))
      const usuario = userEvent.setup({ delay: null })

      await usuario.click(screen.getByRole('button', { name: 'Reabrir fatura' }))

      const texto = screen.getByRole('dialog', { name: 'Reabrir fatura?' }).textContent
      expect(texto).not.toMatch(/parciais/)
    })
  })
})
