// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Despesa } from '@domain/entities/despesa'
import type { StatusFatura } from '@domain/entities/fatura'
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
    totalCentavos: 183881
  }
}

function renderizar(d: FaturaDetalhada) {
  vi.stubGlobal(
    'window',
    Object.assign(window, { api: { categoria: { list: vi.fn().mockResolvedValue([]) } } })
  )
  render(
    <ToastProvider>
      <FaturaDetalhe
        detalhe={d}
        cartaoNome="Inter"
        cartaoCor="#f70"
        onFaturaAtualizada={() => {}}
        onDetalheAtualizado={() => {}}
      />
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
    despesasPorParcela: { [p.id]: d },
    ...extra
  }
}

type ApiExtra = Record<string, Record<string, unknown>>

function renderizarCom(d: FaturaDetalhada, api: ApiExtra = {}) {
  vi.stubGlobal(
    'window',
    Object.assign(window, {
      api: { categoria: { list: vi.fn().mockResolvedValue([]) }, ...api }
    })
  )
  render(
    <ToastProvider>
      <FaturaDetalhe
        detalhe={d}
        cartaoNome="Inter"
        cartaoCor="#f70"
        onFaturaAtualizada={() => {}}
        onDetalheAtualizado={() => {}}
      />
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
        listarPorCartao: vi.fn().mockResolvedValue([detalhe({ kind: 'Aberta' }).fatura]),
        detalharComParcelas: vi.fn().mockResolvedValue(null)
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
          onFaturaAtualizada={() => {}}
          onDetalheAtualizado={() => {}}
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
