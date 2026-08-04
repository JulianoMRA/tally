// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from '../ConfirmDialog'

afterEach(cleanup)

describe('ConfirmDialog (interacao)', () => {
  it('renderiza titulo, corpo e os botoes de acao', () => {
    render(
      <ConfirmDialog
        title="Excluir despesa?"
        body="Esta acao nao pode ser desfeita."
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Excluir despesa?')).toBeTruthy()
    expect(screen.getByText('Esta acao nao pode ser desfeita.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy()
  })

  it('chama onConfirm (e nao onCancel) ao confirmar', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        title="t"
        body="b"
        confirmText="Excluir"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('chama onCancel ao cancelar', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<ConfirmDialog title="t" body="b" onConfirm={() => {}} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('fecha com a tecla Escape', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<ConfirmDialog title="t" body="b" onConfirm={() => {}} onCancel={onCancel} />)
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })
})

describe('ConfirmDialog (foco e semantica)', () => {
  it('leva o foco para dentro do dialogo ao abrir', () => {
    render(<ConfirmDialog title="t" body="b" onConfirm={() => {}} onCancel={() => {}} />)

    // Medido em runtime antes da correcao: o foco ficava no botao da linha que
    // abriu o dialogo, FORA dele, e o Tab caminhava pela pagina atras do overlay.
    const dialogo = screen.getByRole('dialog')
    expect(dialogo.contains(document.activeElement)).toBe(true)
  })

  it('devolve o foco ao gatilho quando fecha', () => {
    function Cena({ aberto }: { aberto: boolean }) {
      return (
        <>
          <button type="button">Excluir</button>
          {aberto && <ConfirmDialog title="t" body="b" onConfirm={() => {}} onCancel={() => {}} />}
        </>
      )
    }
    const { rerender } = render(<Cena aberto={false} />)
    const gatilho = screen.getByRole('button', { name: 'Excluir' })
    gatilho.focus()

    rerender(<Cena aberto />)
    rerender(<Cena aberto={false} />)

    expect(document.activeElement).toBe(gatilho)
  })

  it('descreve o corpo para leitores de tela via aria-describedby', () => {
    render(
      <ConfirmDialog
        title="t"
        body="Isto e irreversivel."
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )

    const dialogo = screen.getByRole('dialog')
    const idCorpo = dialogo.getAttribute('aria-describedby')
    expect(idCorpo).toBeTruthy()
    expect(document.getElementById(idCorpo!)?.textContent).toBe('Isto e irreversivel.')
  })

  it('nao fecha ao clicar no overlay quando a acao e destrutiva', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const { container } = render(
      <ConfirmDialog
        title="t"
        body="b"
        confirmVariant="danger"
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    )

    await user.click(container.firstElementChild as HTMLElement)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('fecha ao clicar no overlay quando a acao nao e destrutiva', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const { container } = render(
      <ConfirmDialog title="t" body="b" onConfirm={() => {}} onCancel={onCancel} />
    )

    await user.click(container.firstElementChild as HTMLElement)
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
