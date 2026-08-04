// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SortableHeader } from '../SortableHeader'

function renderizar(props: Partial<Parameters<typeof SortableHeader>[0]> = {}) {
  return render(
    <table>
      <thead>
        <tr>
          <SortableHeader rotulo="Valor" ativo={false} direcao="asc" onSort={vi.fn()} {...props} />
        </tr>
      </thead>
    </table>
  )
}

describe('SortableHeader', () => {
  afterEach(cleanup)

  it('anuncia a coluna não ordenada com aria-sort="none"', () => {
    renderizar()

    expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('none')
  })

  it('anuncia o sentido quando a coluna está ativa', () => {
    renderizar({ ativo: true, direcao: 'desc' })

    expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('descending')
  })

  it('expõe um botão de verdade, alcançável por teclado', async () => {
    const user = userEvent.setup()
    const onSort = vi.fn()
    renderizar({ onSort })

    const botao = screen.getByRole('button', { name: /Valor/ })
    botao.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    // Antes era um <th onClick> sem role nem tabIndex: ordenar era só mouse.
    expect(onSort).toHaveBeenCalledTimes(2)
  })

  it('mostra a seta só na coluna ativa, e escondida de leitores de tela', () => {
    const { container } = renderizar({ ativo: true, direcao: 'asc' })

    const indicador = container.querySelector('[aria-hidden="true"]')
    expect(indicador?.textContent).toBe('↑')
  })
})
