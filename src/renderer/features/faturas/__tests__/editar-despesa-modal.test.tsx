// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Despesa } from '@domain/entities/despesa'
import { categoria } from '../../../__tests__/__fixtures__/builders'
import { EditarDespesaModal } from '../EditarDespesaModal'

const MORADIA = categoria({ id: 1, nome: 'Moradia' })
const VIAGEM = categoria({ id: 2, nome: 'Viagem', ativo: false })
const ANTIGA = categoria({ id: 3, nome: 'Antiga', ativo: false })

function despesa(over: Partial<Despesa> = {}): Despesa {
  return {
    id: 7,
    descricao: 'Hotel',
    categoriaId: MORADIA.id,
    tipo: 'Unica',
    formaPagamento: 'Credito',
    cartaoId: 1,
    valorCentavos: 45000,
    totalParcelas: null,
    dataCompra: '2026-06-10',
    diaCobranca: null,
    recorreAte: null,
    nota: null,
    ativa: true,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...over
  }
}

function renderModal(over: Partial<Despesa> = {}) {
  const onConfirmar = vi.fn().mockResolvedValue(undefined)
  render(
    <EditarDespesaModal
      despesa={despesa(over)}
      categorias={[ANTIGA, MORADIA, VIAGEM]}
      onConfirmar={onConfirmar}
      onCancelar={vi.fn()}
    />
  )
  const select = screen.getByLabelText('Categoria') as HTMLSelectElement
  return { onConfirmar, select }
}

describe('EditarDespesaModal — categoria arquivada (RF-CAT-02)', () => {
  afterEach(cleanup)

  it('oferece só as categorias ativas quando a atual é ativa', () => {
    const { select } = renderModal()

    expect([...select.options].map((o) => o.textContent)).toEqual(['Moradia'])
  })

  // O select mostrava a primeira categoria da lista quando a atual estava
  // arquivada: o valor salvo seguia certo, mas a tela dizia outra coisa.
  it('mostra a categoria atual arquivada, marcada, sem oferecer as outras arquivadas', () => {
    const { select } = renderModal({ categoriaId: VIAGEM.id })

    expect(select.value).toBe(String(VIAGEM.id))
    expect([...select.options].map((o) => o.textContent)).toEqual(['Moradia', 'Viagem (arquivada)'])
  })

  it('salvar sem mexer na categoria mantém a arquivada', async () => {
    const usuario = userEvent.setup()
    const { onConfirmar } = renderModal({ categoriaId: VIAGEM.id })

    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ categoriaId: VIAGEM.id }))
    )
  })
})

// RF-DES-10 — numa fatura Fechada, a compra à vista não aceita mudança de valor
// nem de data: o modal deixava editar os dois e a gravação era recusada.
describe('EditarDespesaModal — valor e data travados', () => {
  afterEach(cleanup)

  function renderTravado(onConfirmar = vi.fn().mockResolvedValue(undefined)) {
    render(
      <EditarDespesaModal
        despesa={despesa()}
        categorias={[MORADIA]}
        travaValorEData="A fatura desta compra está fechada."
        onConfirmar={onConfirmar}
        onCancelar={vi.fn()}
      />
    )
    return onConfirmar
  }

  it('desabilita valor e data e diz por quê', () => {
    renderTravado()

    expect((screen.getByLabelText('Valor (R$)') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Data da compra') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText('A fatura desta compra está fechada.')).toBeTruthy()
  })

  it('descrição segue editável e o salvar não manda a data', async () => {
    const onConfirmar = renderTravado()
    const usuario = userEvent.setup()

    const descricao = screen.getByLabelText('Descrição')
    await usuario.clear(descricao)
    await usuario.type(descricao, 'Hotel da viagem')
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onConfirmar).toHaveBeenCalled())
    expect(onConfirmar.mock.calls[0]![0]).toEqual({
      descricao: 'Hotel da viagem',
      categoriaId: MORADIA.id,
      valorCentavos: 45000,
      dataCompra: undefined
    })
  })
})

describe('EditarDespesaModal — erro ao salvar', () => {
  afterEach(cleanup)

  // O erro do main chega embrulhado pelo Electron, e o modal o mostrava cru.
  it('mostra a mensagem sem o prefixo do Electron', async () => {
    const onConfirmar = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "Error invoking remote method 'despesa:atualizar': Error: Edição de valor bloqueada."
        )
      )
    render(
      <EditarDespesaModal
        despesa={despesa()}
        categorias={[MORADIA]}
        onConfirmar={onConfirmar}
        onCancelar={vi.fn()}
      />
    )
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Edição de valor bloqueada.')).toBeTruthy()
    expect(screen.queryByText(/Error invoking/)).toBeNull()
  })

  it('a parcelada diz que o valor novo vale só para as parcelas em fatura aberta', () => {
    render(
      <EditarDespesaModal
        despesa={despesa({ tipo: 'Parcelada', totalParcelas: 3 })}
        categorias={[MORADIA]}
        onConfirmar={vi.fn()}
        onCancelar={vi.fn()}
      />
    )

    expect(screen.getByText(/recalcula as parcelas em faturas abertas/)).toBeTruthy()
  })
})

// RF-DES-10 — a linha de apoio mostrava o valor cru do tipo ("Tipo: Unica.
// Edição direta."), e a descrição cortava em 80 caracteres, quando o cadastro
// aceita 120. O modal é o mesmo em Saídas e em Faturas.
describe('EditarDespesaModal — texto e limite da descrição', () => {
  afterEach(cleanup)

  function textoDoModal(): string {
    return screen.getByRole('dialog', { name: 'Editar despesa' }).textContent ?? ''
  }

  it('compra à vista diz "Compra à vista.", sem o nome interno do tipo', () => {
    renderModal()

    expect(textoDoModal()).toMatch(/Compra à vista\./)
    expect(textoDoModal()).not.toMatch(/Tipo:|Unica|Edição direta/)
  })

  it('parcelada diz "Compra parcelada." antes do aviso do recálculo', () => {
    renderModal({ tipo: 'Parcelada', totalParcelas: 3 })

    expect(textoDoModal()).toMatch(/Compra parcelada\. Mudar o valor recalcula as parcelas/)
  })

  it('a descrição aceita os 120 caracteres do cadastro', async () => {
    renderModal()
    const usuario = userEvent.setup({ delay: null })
    const campo = screen.getByLabelText('Descrição') as HTMLInputElement

    await usuario.clear(campo)
    await usuario.type(campo, 'x'.repeat(130))

    expect(campo.value).toHaveLength(120)
  })
})
