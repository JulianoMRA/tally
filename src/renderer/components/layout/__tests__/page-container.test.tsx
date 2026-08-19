// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { PageContainer } from '../PageContainer'

// O vitest roda com `css: false`, então CSS Module devolve string vazia e a
// classe não serve de asserção — por isso o componente expõe `data-page`.
describe('PageContainer', () => {
  afterEach(cleanup)

  it('envolve o conteúdo num único elemento', () => {
    const { container } = render(
      <PageContainer>
        <span>um</span>
        <span>dois</span>
      </PageContainer>
    )

    expect(container.children).toHaveLength(1)
    expect(container.querySelector('[data-page]')?.children).toHaveLength(2)
  })

  /**
   * O guard que sobrou depois de colapsar os três tiers numa largura só.
   *
   * A prop `width` existia para escolher entre 760, 1200 e 1760, e era ela que
   * fazia cada rota começar num x diferente — o defeito que
   * `e2e/alinhamento-paginas.spec.ts` trava do lado de fora. Reintroduzir uma
   * API de largura por página traz o desalinhamento de volta, então o container
   * não aceita nenhuma prop além de `children`.
   */
  it('não expõe API de largura por página', () => {
    const { container } = render(<PageContainer>conteudo</PageContainer>)
    const pagina = container.querySelector('[data-page]')

    expect(pagina).not.toBeNull()
    expect(pagina?.getAttribute('data-page')).toBe('')
    expect(pagina?.hasAttribute('data-width')).toBe(false)
  })
})
