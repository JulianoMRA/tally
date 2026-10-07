// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Despesa } from '@domain/entities/despesa'
import { motivoDoBloqueioDeExclusao, travaDeValorEData } from '../acoes-da-despesa'
import { DialogoExcluirDespesa } from '../DialogoExcluirDespesa'

/**
 * As regras da linha de uma despesa que Saídas e Faturas precisam dizer igual:
 * por que Excluir está bloqueado, por que valor e data não mudam, e o que o
 * diálogo de exclusão diz. Moravam no `FaturaDetalhe`, e Saídas oferecia
 * Excluir em toda linha e deixava editar o que a gravação recusaria.
 */
describe('motivoDoBloqueioDeExclusao (RF-DES-09)', () => {
  it('parcela paga, vista na linha ou no bloqueio da despesa', () => {
    expect(motivoDoBloqueioDeExclusao('Paga', undefined)).toMatch(/parcela paga/)
    expect(motivoDoBloqueioDeExclusao('Pendente', 'has-parcela-paga')).toMatch(/parcela paga/)
  })

  it('parcela em fatura fechada', () => {
    expect(motivoDoBloqueioDeExclusao('Pendente', 'has-parcela-em-fatura-fechada')).toMatch(
      /fatura fechada/
    )
  })

  it('sem bloqueio, não há motivo', () => {
    expect(motivoDoBloqueioDeExclusao('Pendente', undefined)).toBeNull()
  })
})

describe('travaDeValorEData (RF-DES-10)', () => {
  it('compra à vista em fatura que não está Aberta trava, e diz por quê', () => {
    expect(travaDeValorEData('Unica', 'Fechada')).toMatch(/fatura desta compra está fechada/)
    expect(travaDeValorEData('Unica', 'Paga')).toMatch(/fatura desta compra está fechada/)
  })

  it('compra à vista em fatura Aberta, ou fora de fatura, não trava', () => {
    expect(travaDeValorEData('Unica', 'Aberta')).toBeUndefined()
    expect(travaDeValorEData('Unica', undefined)).toBeUndefined()
  })

  // A parcelada tem regra própria: a data nunca muda, e o valor novo vale só
  // para as parcelas em fatura aberta.
  it('parcelada não passa por esta trava', () => {
    expect(travaDeValorEData('Parcelada', 'Fechada')).toBeUndefined()
  })
})

describe('DialogoExcluirDespesa (RF-DES-09)', () => {
  afterEach(cleanup)

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

  it('nomeia a despesa e só exclui na confirmação', async () => {
    const onConfirmar = vi.fn()
    render(
      <DialogoExcluirDespesa despesa={despesa()} onConfirmar={onConfirmar} onCancelar={vi.fn()} />
    )
    const dialogo = screen.getByRole('dialog', { name: 'Excluir despesa?' })

    expect(dialogo.textContent).toMatch(/Notebook, R\$\s*3\.000,00 em 3 parcelas\./)
    expect(onConfirmar).not.toHaveBeenCalled()

    await userEvent.setup().click(within(dialogo).getByRole('button', { name: 'Excluir' }))

    expect(onConfirmar).toHaveBeenCalledTimes(1)
  })
})
