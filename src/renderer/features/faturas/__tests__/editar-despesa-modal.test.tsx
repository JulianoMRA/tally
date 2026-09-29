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
