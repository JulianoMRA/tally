// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { PageContainer } from '../PageContainer'

// O vitest roda com `css: false`, então CSS Module devolve string vazia e a
// classe não serve de asserção — por isso o componente expõe `data-width`.
function blocoDePagina(elemento: React.JSX.Element): HTMLElement | null {
  const { container } = render(elemento)
  return container.querySelector<HTMLElement>('[data-width]')
}

function larguraRenderizada(elemento: React.JSX.Element): string | undefined {
  return blocoDePagina(elemento)?.dataset.width
}

describe('PageContainer', () => {
  afterEach(cleanup)

  it('usa a largura padrão quando nenhuma é informada', () => {
    expect(larguraRenderizada(<PageContainer>conteudo</PageContainer>)).toBe('default')
  })

  it('aplica a largura estreita nas páginas de formulário único', () => {
    expect(larguraRenderizada(<PageContainer width="narrow">conteudo</PageContainer>)).toBe(
      'narrow'
    )
  })

  it('aplica a largura larga nas páginas densas', () => {
    expect(larguraRenderizada(<PageContainer width="wide">conteudo</PageContainer>)).toBe('wide')
  })

  it('envolve o conteúdo num único elemento', () => {
    const { container } = render(
      <PageContainer>
        <span>um</span>
        <span>dois</span>
      </PageContainer>
    )

    expect(container.children).toHaveLength(1)
    expect(container.querySelector('[data-width]')?.children).toHaveLength(2)
  })

  // O trilho é o que garante que todas as telas comecem no mesmo x: ele é
  // idêntico em qualquer tier, e só o bloco interno varia. Se alguém colapsar os
  // dois de volta num elemento só, o desalinhamento entre telas volta junto.
  it('separa o trilho do bloco que carrega a largura', () => {
    const { container } = render(<PageContainer width="narrow">conteudo</PageContainer>)

    const trilho = container.firstElementChild
    expect(trilho).not.toBeNull()
    expect(trilho?.hasAttribute('data-width')).toBe(false)
    expect(trilho?.children).toHaveLength(1)
    expect(trilho?.firstElementChild?.getAttribute('data-width')).toBe('narrow')
  })
})
