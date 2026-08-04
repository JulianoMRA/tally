// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { PageContainer } from '../PageContainer'

// O vitest roda com `css: false`, então CSS Module devolve string vazia e a
// classe não serve de asserção — por isso o componente expõe `data-width`.
function larguraRenderizada(elemento: React.JSX.Element): string | undefined {
  const { container } = render(elemento)
  return (container.firstElementChild as HTMLElement | null)?.dataset.width
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
    expect(container.firstElementChild?.children).toHaveLength(2)
  })
})
