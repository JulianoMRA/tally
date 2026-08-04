// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFocusTrap } from '../use-focus-trap'

function Modal({ comFocaveis = true }: { comFocaveis?: boolean }) {
  const ref = useFocusTrap<HTMLDivElement>()
  return (
    <div ref={ref} role="dialog" aria-label="Modal">
      {comFocaveis && (
        <>
          <button type="button">Primeiro</button>
          <button type="button">Segundo</button>
        </>
      )}
      {!comFocaveis && <p>Sem nada focável</p>}
    </div>
  )
}

function Cena({ aberto, comFocaveis }: { aberto: boolean; comFocaveis?: boolean }) {
  return (
    <>
      <button type="button">Gatilho</button>
      {aberto && <Modal comFocaveis={comFocaveis} />}
    </>
  )
}

describe('useFocusTrap', () => {
  afterEach(cleanup)

  it('move o foco para dentro do modal ao abrir', () => {
    render(<Cena aberto />)

    // Sem o trap, o foco ficava no gatilho — FORA do diálogo — e o Tab
    // caminhava pela página atrás do overlay.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Primeiro' }))
  })

  it('cicla o Tab entre o primeiro e o último focável', async () => {
    const user = userEvent.setup()
    render(<Cena aberto />)

    const primeiro = screen.getByRole('button', { name: 'Primeiro' })
    const ultimo = screen.getByRole('button', { name: 'Segundo' })

    await user.tab()
    expect(document.activeElement).toBe(ultimo)

    await user.tab()
    expect(document.activeElement).toBe(primeiro)

    await user.tab({ shift: true })
    expect(document.activeElement).toBe(ultimo)
  })

  it('devolve o foco ao gatilho quando o modal fecha', () => {
    const { rerender } = render(<Cena aberto={false} />)
    const gatilho = screen.getByRole('button', { name: 'Gatilho' })
    gatilho.focus()

    rerender(<Cena aberto />)
    expect(document.activeElement).not.toBe(gatilho)

    rerender(<Cena aberto={false} />)
    expect(document.activeElement).toBe(gatilho)
  })

  it('foca o próprio container quando não há nada focável dentro', () => {
    render(<Cena aberto comFocaveis={false} />)

    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })
})
