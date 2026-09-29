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

  describe('alinhamento', () => {
    it('alinha à esquerda por padrão, com a seta depois do rótulo', () => {
      renderizar({ ativo: true, direcao: 'asc' })

      const botao = screen.getByRole('button')
      expect(screen.getByRole('columnheader').dataset.alinhamento).toBe('esquerda')
      expect(botao.firstChild?.textContent).toBe('Valor')
      expect(botao.lastChild?.textContent).toBe('↑')
    })

    // O CSS alinha o botão pela célula: `text-align` herdado não move item de
    // flex, e o rótulo de toda coluna de valor ficava na borda esquerda.
    it('declara na célula o alinhamento à direita, que o CSS consome', () => {
      renderizar({ alinhamento: 'direita' })

      expect(screen.getByRole('columnheader').dataset.alinhamento).toBe('direita')
    })

    // Com a seta à direita, ordenar pela coluna empurraria o rótulo para a
    // esquerda e ele deixaria de terminar na borda dos valores.
    it('em coluna à direita, põe a seta antes do rótulo', () => {
      renderizar({ alinhamento: 'direita', ativo: true, direcao: 'desc' })

      const botao = screen.getByRole('button')
      expect(botao.firstChild?.textContent).toBe('↓')
      expect(botao.lastChild?.textContent).toBe('Valor')
    })

    it('em coluna à direita e inativa, o botão tem só o rótulo', () => {
      renderizar({ alinhamento: 'direita' })

      expect(screen.getByRole('button').childNodes).toHaveLength(1)
    })
  })
})
