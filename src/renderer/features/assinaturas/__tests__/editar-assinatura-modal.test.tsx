// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Categoria } from '@domain/entities/categoria'
import type { Despesa } from '@domain/entities/despesa'
import { EditarAssinaturaModal } from '../EditarAssinaturaModal'

const CATEGORIAS: Categoria[] = [
  {
    id: 1,
    nome: 'Moradia',
    tipo: 'Despesa',
    cor: '#aaa',
    ativo: true,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z'
  }
]

function assinatura(over: Partial<Despesa> = {}): Despesa {
  return {
    id: 7,
    descricao: 'Aluguel',
    categoriaId: 1,
    tipo: 'Assinatura',
    formaPagamento: 'Pix',
    cartaoId: null,
    valorCentavos: 150000,
    totalParcelas: null,
    dataCompra: '2026-06-10',
    diaCobranca: 10,
    recorreAte: null,
    nota: null,
    ativa: true,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...over
  }
}

function renderModal(over: Partial<Despesa> = {}, comLimite = true) {
  const onConfirmar = vi.fn().mockResolvedValue(undefined)
  const onAlterarLimite = vi.fn().mockResolvedValue(undefined)
  render(
    <EditarAssinaturaModal
      assinatura={assinatura(over)}
      categorias={CATEGORIAS}
      onConfirmar={onConfirmar}
      onAlterarLimite={comLimite ? onAlterarLimite : undefined}
      onCancelar={vi.fn()}
    />
  )
  return { onConfirmar, onAlterarLimite }
}

describe('EditarAssinaturaModal — limite de recorrência (RF-DES-19)', () => {
  afterEach(cleanup)

  it('não oferece duração quando a assinatura é de cartão', () => {
    // A de crédito não recebe o callback: o limite não existe para ela.
    renderModal({ cartaoId: 3, formaPagamento: 'Credito' }, false)

    expect(screen.queryByRole('radio', { name: 'Até uma data' })).toBeNull()
  })

  it('abre em "Sempre" quando a recorrente não tem limite', () => {
    renderModal()

    // O SegmentedControl e um grupo de <button role="radio">, entao o estado
    // esta em `aria-checked` e nao na propriedade `checked` de um input.
    expect(screen.getByRole('radio', { name: 'Sempre' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByLabelText('Recorrente até')).toBeNull()
  })

  it('abre em "Até uma data" com o limite preenchido quando já existe', () => {
    renderModal({ recorreAte: '2027-03-15' })

    expect((screen.getByLabelText('Recorrente até') as HTMLInputElement).value).toBe('2027-03-15')
  })

  it('não chama a alteração de limite quando o limite não mudou', async () => {
    // Alterar o limite regenera ou apaga ocorrências futuras; pagar isso a cada
    // salvamento seria mexer em dado sem motivo.
    const usuario = userEvent.setup()
    const { onConfirmar, onAlterarLimite } = renderModal()

    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onConfirmar).toHaveBeenCalled())
    expect(onAlterarLimite).not.toHaveBeenCalled()
  })

  it('chama a alteração com a data quando passa a ter limite', async () => {
    const usuario = userEvent.setup()
    const { onAlterarLimite } = renderModal()

    await usuario.click(screen.getByRole('radio', { name: 'Até uma data' }))
    await usuario.type(screen.getByLabelText('Recorrente até'), '2027-03-15')
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onAlterarLimite).toHaveBeenCalledWith('2027-03-15'))
  })

  it('chama a alteração com null ao voltar para "Sempre"', async () => {
    const usuario = userEvent.setup()
    const { onAlterarLimite } = renderModal({ recorreAte: '2027-03-15' })

    await usuario.click(screen.getByRole('radio', { name: 'Sempre' }))
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onAlterarLimite).toHaveBeenCalledWith(null))
  })

  it('recusa salvar em "Até uma data" sem data preenchida', async () => {
    const usuario = userEvent.setup()
    const { onConfirmar, onAlterarLimite } = renderModal()

    await usuario.click(screen.getByRole('radio', { name: 'Até uma data' }))
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(screen.getByText('Informe a data limite.')).toBeTruthy()
    expect(onConfirmar).not.toHaveBeenCalled()
    expect(onAlterarLimite).not.toHaveBeenCalled()
  })
})
