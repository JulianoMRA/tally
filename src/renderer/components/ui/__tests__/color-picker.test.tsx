// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColorPicker, COR_PADRAO } from '../ColorPicker'

/** Cor fora da paleta, como a escolhida em "Outra…". */
const COR_LIVRE = '#123456'

/** O seletor dentro de um formulário de verdade: o valor muda a cada escolha. */
function SeletorControlado({ inicial }: { inicial: string }) {
  const [cor, setCor] = useState(inicial)
  return <ColorPicker value={cor} onChange={setCor} label="Cor" />
}

function swatch(nome: string): HTMLElement {
  return screen.getByRole('radio', { name: nome })
}

describe('ColorPicker', () => {
  afterEach(cleanup)

  it('avisa a cor no clique', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ColorPicker value={COR_PADRAO} onChange={onChange} label="Cor" />)

    await user.click(swatch('Bronze'))

    expect(onChange).toHaveBeenCalledWith('#a88454')
  })

  it('só a cor escolhida é parada de Tab', () => {
    render(<ColorPicker value="#a88454" onChange={vi.fn()} label="Cor" />)

    expect(swatch('Bronze').tabIndex).toBe(0)
    expect(swatch('Verde escuro').tabIndex).toBe(-1)
    expect(swatch('Azul').tabIndex).toBe(-1)
  })

  // Com a cor escolhida em "Outra…", nenhum swatch estava marcado — e por isso
  // nenhum era parada de Tab: o grupo inteiro sumia do teclado.
  it('com a cor livre, a primeira cor é a parada de Tab', () => {
    render(<ColorPicker value={COR_LIVRE} onChange={vi.fn()} label="Cor" />)

    const swatches = screen.getAllByRole('radio')
    expect(swatches.map((s) => s.tabIndex)).toEqual([0, ...swatches.slice(1).map(() => -1)])
    expect(swatches.every((s) => s.getAttribute('aria-checked') === 'false')).toBe(true)
  })

  it('a seta escolhe a cor seguinte e leva o foco junto', async () => {
    const user = userEvent.setup()
    render(<SeletorControlado inicial={COR_PADRAO} />)

    swatch('Verde escuro').focus()
    await user.keyboard('{ArrowRight}')

    expect(swatch('Verde sálvia').getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(swatch('Verde sálvia'))
    expect(swatch('Verde sálvia').tabIndex).toBe(0)
  })

  it('as setas dão a volta nas pontas, e Home e End vão a elas', async () => {
    const user = userEvent.setup()
    render(<SeletorControlado inicial={COR_PADRAO} />)

    swatch('Verde escuro').focus()
    await user.keyboard('{ArrowLeft}')
    expect(swatch('Azul').getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(swatch('Azul'))

    await user.keyboard('{Home}')
    expect(swatch('Verde escuro').getAttribute('aria-checked')).toBe('true')

    await user.keyboard('{End}')
    expect(swatch('Azul').getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(swatch('Azul'))
  })

  // A seta anda a partir de onde o foco está. Com a cor livre o foco entra na
  // primeira, que não está marcada: a seta para a direita vai para a segunda.
  it('com a cor livre, a seta anda a partir da cor focada', async () => {
    const user = userEvent.setup()
    render(<SeletorControlado inicial={COR_LIVRE} />)

    swatch('Verde escuro').focus()
    await user.keyboard('{ArrowRight}')

    expect(swatch('Verde sálvia').getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(swatch('Verde sálvia'))
  })

  it('outra tecla passa sem escolher nada', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ColorPicker value={COR_PADRAO} onChange={onChange} label="Cor" />)

    swatch('Verde escuro').focus()
    await user.keyboard('a')

    expect(onChange).not.toHaveBeenCalled()
  })
})
