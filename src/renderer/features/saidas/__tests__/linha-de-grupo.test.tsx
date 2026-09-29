// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { formatBRL } from '../../../lib/format-brl'
import { LinhaDeGrupo } from '../LinhaDeGrupo'

function renderizar(props: Partial<Parameters<typeof LinhaDeGrupo>[0]> = {}) {
  return render(
    <table>
      <tbody>
        <LinhaDeGrupo rotulo="Inter" totalCentavos={183881} colunasDoRotulo={4} {...props} />
      </tbody>
    </table>
  )
}

describe('LinhaDeGrupo', () => {
  afterEach(cleanup)

  // O subtotal ocupava uma célula só com a linha inteira (`colSpan={6}`) e
  // encostava na borda da tabela, depois da coluna de ações — longe da borda
  // em que os valores das linhas terminam.
  it('põe o rótulo sobre as colunas de texto e o subtotal na coluna de valor', () => {
    renderizar()

    const [rotulo, subtotal, acoes] = screen.getAllByRole('cell')
    expect(screen.getAllByRole('cell')).toHaveLength(3)
    expect(rotulo?.getAttribute('colspan')).toBe('4')
    expect(rotulo?.textContent).toBe('Inter')
    expect(subtotal?.textContent).toBe(formatBRL(183881))
    expect(acoes?.textContent).toBe('')
  })

  it('segue o número de colunas que a tabela tiver antes da de valor', () => {
    renderizar({ colunasDoRotulo: 5 })

    expect(screen.getAllByRole('cell')[0]?.getAttribute('colspan')).toBe('5')
  })

  // O nome acessível da célula é o que os specs E2E usam para achar a seção.
  it('dá à célula do rótulo só o nome do grupo', () => {
    renderizar()

    expect(screen.getByRole('cell', { name: 'Inter' })).toBeTruthy()
  })

  // Sem agrupamento por origem, o nome do cartão aparece também na coluna
  // Origem das linhas: o cabeçalho da seção precisa de uma marca própria.
  it('marca a linha como cabeçalho de seção', () => {
    renderizar()

    expect(screen.getByRole('row').hasAttribute('data-grupo')).toBe(true)
  })

  it('categoria arquivada leva o selo no cabeçalho da seção', () => {
    renderizar({ rotulo: 'Viagem', arquivada: true })

    expect(screen.getByText('Arquivada')).toBeTruthy()
  })

  it('sem arquivada, sem selo', () => {
    renderizar()

    expect(screen.queryByText('Arquivada')).toBeNull()
  })

  describe('bolinha de cor', () => {
    it('pinta a bolinha com a cor do grupo, escondida de leitores de tela', () => {
      const { container } = renderizar({ cor: '#a88454' })

      const bolinha = container.querySelector<HTMLElement>('[data-bolinha]')
      expect(bolinha?.getAttribute('aria-hidden')).toBe('true')
      expect(bolinha?.style.background).toBe('rgb(168, 132, 84)')
    })

    // "Fora do cartão" não tem cor. O espaço fica reservado para o texto
    // começar na mesma posição que o dos grupos de cartão.
    it('sem cor, reserva o espaço sem pintar nada', () => {
      const { container } = renderizar({ cor: undefined })

      const bolinha = container.querySelector<HTMLElement>('[data-bolinha]')
      expect(bolinha?.dataset.bolinha).toBe('vazia')
      expect(bolinha?.style.background).toBe('')
    })
  })
})
