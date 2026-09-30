// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Fatura, StatusFatura } from '@domain/entities/fatura'
import { AdiantarParcelasModal } from '../AdiantarParcelasModal'

function fatura(id: number, mesReferencia: string, status: StatusFatura = { kind: 'Aberta' }) {
  return {
    id,
    cartaoId: 1,
    mesReferencia,
    dataFechamento: `${mesReferencia}-24`,
    dataVencimento: `${mesReferencia}-28`,
    status,
    createdAt: '',
    updatedAt: ''
  } satisfies Fatura
}

function renderizar(faturas: Fatura[], faturaAtualId: number, onConfirmar = vi.fn()) {
  vi.stubGlobal(
    'window',
    Object.assign(window, {
      api: { fatura: { listarPorCartao: vi.fn().mockResolvedValue(faturas) } }
    })
  )
  render(
    <AdiantarParcelasModal
      despesaId={5}
      descricao="Notebook"
      cartaoId={1}
      faturaAtualId={faturaAtualId}
      onConfirmar={onConfirmar}
      onCancelar={vi.fn()}
    />
  )
  return onConfirmar
}

async function opcoesDoDestino(): Promise<{ valor: string; opcoes: string[] }> {
  const select = (await screen.findByLabelText('Fatura destino')) as HTMLSelectElement
  await waitFor(() => expect(select.disabled).toBe(false))
  return { valor: select.value, opcoes: [...select.options].map((o) => o.textContent ?? '') }
}

/**
 * RN-03 — o destino padrão é a fatura aberta corrente. O modal excluía a
 * fatura em tela das opções: quem via outubro (Aberta) recebia novembro como
 * sugestão, a 6/6 ia para novembro e nada mudava na tela.
 */
describe('AdiantarParcelasModal', () => {
  afterEach(cleanup)

  it('o destino padrão é a fatura em tela', async () => {
    renderizar(
      [fatura(9, '2026-09', { kind: 'Fechada' }), fatura(10, '2026-10'), fatura(11, '2026-11')],
      10
    )

    const { valor } = await opcoesDoDestino()
    expect(valor).toBe('10')
  })

  // Uma fatura depois da em tela receberia parcelas que vêm antes dela: o
  // contrário de adiantar. Fechada não recebe adiantamento (RN-06).
  it('oferece só as faturas abertas até a em tela, da mais recente para trás', async () => {
    renderizar(
      [
        fatura(9, '2026-09', { kind: 'Fechada' }),
        fatura(10, '2026-10'),
        fatura(11, '2026-11'),
        fatura(12, '2026-12')
      ],
      11
    )

    const { opcoes } = await opcoesDoDestino()
    expect(opcoes.map((o) => o.split(' (')[0])).toEqual(['Novembro de 2026', 'Outubro de 2026'])
  })

  it('confirma com a fatura em tela quando ninguém troca o destino', async () => {
    const onConfirmar = renderizar([fatura(10, '2026-10'), fatura(11, '2026-11')], 10)
    const usuario = userEvent.setup()
    await opcoesDoDestino()

    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(onConfirmar).toHaveBeenCalledWith(5, 1, 10)
  })

  it('mostra o erro do adiantamento sem o prefixo do Electron', async () => {
    const onConfirmar = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "Error invoking remote method 'despesa:adiantarParcelas': Error: Fatura destino #10 não encontrada"
        )
      )
    renderizar([fatura(10, '2026-10')], 10, onConfirmar)
    const usuario = userEvent.setup()
    await opcoesDoDestino()

    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Fatura destino #10 não encontrada')).toBeTruthy()
  })
})
