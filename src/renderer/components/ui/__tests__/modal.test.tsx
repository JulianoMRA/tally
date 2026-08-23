// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from '../Modal'

describe('Modal', () => {
  afterEach(cleanup)

  it('expõe o diálogo nomeado pelo título visível, sem duplicar o texto num aria-label', () => {
    render(
      <Modal titulo="Editar assinatura" onFechar={vi.fn()}>
        <p>corpo</p>
      </Modal>
    )

    const dialogo = screen.getByRole('dialog', { name: 'Editar assinatura' })
    // aria-labelledby aponta para o h2; um aria-label repetiria o título e
    // venceria o elemento visível, que é o que os seis modais faziam antes.
    expect(dialogo.getAttribute('aria-label')).toBeNull()
    expect(dialogo.getAttribute('aria-labelledby')).toBeTruthy()
    expect(dialogo.getAttribute('aria-modal')).toBe('true')
  })

  it('liga a descrição ao diálogo por aria-describedby', () => {
    render(
      <Modal titulo="t" descricao="Mudar o valor aplica às pendentes." onFechar={vi.fn()}>
        <p>corpo</p>
      </Modal>
    )

    const id = screen.getByRole('dialog').getAttribute('aria-describedby')
    expect(id).toBeTruthy()
    expect(document.getElementById(id!)?.textContent).toBe('Mudar o valor aplica às pendentes.')
  })

  it('não anuncia descrição quando não há', () => {
    render(
      <Modal titulo="t" onFechar={vi.fn()}>
        <p>corpo</p>
      </Modal>
    )

    expect(screen.getByRole('dialog').getAttribute('aria-describedby')).toBeNull()
  })

  it('leva o foco para dentro do diálogo ao abrir', () => {
    render(
      <Modal titulo="t" onFechar={vi.fn()}>
        <button type="button">Campo</button>
      </Modal>
    )

    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })

  it('fecha com Esc', async () => {
    const user = userEvent.setup()
    const onFechar = vi.fn()
    render(
      <Modal titulo="t" onFechar={onFechar}>
        <p>corpo</p>
      </Modal>
    )

    await user.keyboard('{Escape}')

    expect(onFechar).toHaveBeenCalled()
  })

  // Padrão invertido em relação ao SidePanel: todo modal do app carrega
  // formulário com dado digitado, então o clique fora só fecha quando a tela
  // pedir por isso.
  it('não fecha ao clicar no overlay por padrão', async () => {
    const user = userEvent.setup()
    const onFechar = vi.fn()
    const { container } = render(
      <Modal titulo="t" onFechar={onFechar}>
        <p>corpo</p>
      </Modal>
    )

    await user.click(container.firstElementChild as HTMLElement)

    expect(onFechar).not.toHaveBeenCalled()
  })

  it('fecha ao clicar no overlay quando a tela pede', async () => {
    const user = userEvent.setup()
    const onFechar = vi.fn()
    const { container } = render(
      <Modal titulo="t" onFechar={onFechar} fecharNoOverlay>
        <p>corpo</p>
      </Modal>
    )

    await user.click(container.firstElementChild as HTMLElement)

    expect(onFechar).toHaveBeenCalled()
  })

  it('não fecha ao clicar dentro do diálogo, mesmo com fecharNoOverlay', async () => {
    const user = userEvent.setup()
    const onFechar = vi.fn()
    render(
      <Modal titulo="t" onFechar={onFechar} fecharNoOverlay>
        <p>corpo</p>
      </Modal>
    )

    await user.click(screen.getByText('corpo'))

    expect(onFechar).not.toHaveBeenCalled()
  })

  it('renderiza o rodapé de ações quando recebido', () => {
    render(
      <Modal titulo="t" onFechar={vi.fn()} rodape={<button type="button">Salvar</button>}>
        <p>corpo</p>
      </Modal>
    )

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy()
  })
})
