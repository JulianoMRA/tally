// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PageHead } from '../PageHead'

describe('PageHead', () => {
  afterEach(cleanup)

  // O título subiu para a barra de título, onde vive o `h1` da árvore. Se o
  // PageHead voltasse a renderizar um, a página passaria a ter dois — o par
  // link-de-nav ↔ h1 deixaria de identificar a rota, e o axe acusaria.
  it('não renderiza título: ele vive na barra de título', () => {
    render(<PageHead title="Visão mensal" subtitle="Resumo do mês." />)

    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByText('Visão mensal')).toBeNull()
  })

  it('mostra o subtítulo e as ações na mesma linha', () => {
    render(
      <PageHead
        title="Saídas"
        subtitle="Gastos do mês."
        actions={<button type="button">Nova saída</button>}
      />
    )

    expect(screen.getByText('Gastos do mês.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Nova saída' })).toBeTruthy()
  })

  it('não deixa linha vazia quando não há subtítulo nem ações', () => {
    const { container } = render(<PageHead title="Cartões" />)

    expect(container.innerHTML).toBe('')
  })
})
