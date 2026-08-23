// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DespesaComTags } from '@shared/ipc/despesa'
import { NotaETagsModal } from '../NotaETagsModal'

const DESPESA = {
  id: 1,
  descricao: 'Notebook',
  nota: null,
  tags: []
} as unknown as DespesaComTags

describe('NotaETagsModal', () => {
  afterEach(cleanup)

  // O modal carrega texto livre: uma nota digitada e tags ainda não salvas.
  // Fechar no clique do overlay descarta tudo sem confirmação, que é o caso
  // que `SidePanel` e `ConfirmDialog` já tratam travando o overlay.
  it('não fecha ao clicar no overlay, para não descartar a nota digitada', async () => {
    const user = userEvent.setup()
    const onCancelar = vi.fn()
    const { container } = render(
      <NotaETagsModal despesa={DESPESA} onConfirmar={vi.fn()} onCancelar={onCancelar} />
    )

    await user.type(screen.getByLabelText('Nota'), 'reembolsável pelo trabalho')
    await user.click(container.firstElementChild as HTMLElement)

    expect(onCancelar).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Nota') as HTMLTextAreaElement).value).toBe(
      'reembolsável pelo trabalho'
    )
  })

  it('continua fechando com Esc', async () => {
    const user = userEvent.setup()
    const onCancelar = vi.fn()
    render(<NotaETagsModal despesa={DESPESA} onConfirmar={vi.fn()} onCancelar={onCancelar} />)

    await user.keyboard('{Escape}')

    expect(onCancelar).toHaveBeenCalled()
  })

  it('continua fechando pelo botão Cancelar', async () => {
    const user = userEvent.setup()
    const onCancelar = vi.fn()
    render(<NotaETagsModal despesa={DESPESA} onConfirmar={vi.fn()} onCancelar={onCancelar} />)

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onCancelar).toHaveBeenCalled()
  })
})
