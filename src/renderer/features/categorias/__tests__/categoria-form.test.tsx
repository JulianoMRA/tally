// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { CategoriaForm } from '../CategoriaForm'
import { CORES_DE_CATEGORIA } from '../cores-de-categoria'

/** O jsdom devolve a cor do `style` inline como `rgb(r, g, b)`. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

function coresOferecidas(): string[] {
  const grupo = screen.getByRole('radiogroup', { name: 'Cor' })
  return [...grupo.querySelectorAll<HTMLElement>('[role="radio"]')].map(
    (swatch) => swatch.style.backgroundColor
  )
}

describe('CategoriaForm', () => {
  afterEach(cleanup)

  it('oferece a paleta de categoria no seletor de cor', () => {
    render(<CategoriaForm onSalvar={vi.fn()} onCancelar={vi.fn()} />)

    expect(coresOferecidas()).toEqual(CORES_DE_CATEGORIA.map((cor) => rgb(cor.hex)))
  })

  // Até nov/2026 o seletor era o mesmo do cartão, e a categoria nova podia sair
  // com o roxo do Nubank ou o laranja do Inter: uma bolinha na coluna Categoria
  // igual à do cartão na coluna Origem, lado a lado em Saídas.
  it('não oferece as cores dos bancos, que são do cadastro de cartão', () => {
    render(<CategoriaForm onSalvar={vi.fn()} onCancelar={vi.fn()} />)

    expect(coresOferecidas()).not.toContain(rgb('#820ad1'))
    expect(coresOferecidas()).not.toContain(rgb('#ff7a00'))
  })

  it('a categoria nova começa marcada na primeira sugestão', () => {
    render(<CategoriaForm onSalvar={vi.fn()} onCancelar={vi.fn()} />)

    const primeira = screen.getByRole('radio', { name: CORES_DE_CATEGORIA[0].nome })
    expect(primeira.getAttribute('aria-checked')).toBe('true')
  })
})
