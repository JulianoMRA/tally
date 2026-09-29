// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
import type { TotalPorCategoria } from '@shared/ipc/relatorio'
import { montarPizza } from '../montar-pizza'
import { PizzaCategorias } from '../PizzaCategorias'

function total(
  categoriaId: number,
  categoriaNome: string,
  totalCentavos: number,
  cor = '#5a4a8a'
): TotalPorCategoria {
  return { categoriaId, categoriaNome, cor, totalCentavos }
}

const TRES = [
  total(1, 'Casa', 20000, '#3f6e47'),
  total(2, 'Mercado', 10000, '#5b7a5e'),
  total(3, 'Lazer', 10000, '#8c3b2e')
]

/** `n` categorias com valores decrescentes — de 7 em diante nasce "Outros". */
function categorias(n: number): TotalPorCategoria[] {
  const nomes = ['Casa', 'Mercado', 'Transporte', 'Lazer', 'Assinaturas', 'Saúde', 'Presentes']
  const extras = ['Pets', 'Educação', 'Viagem']
  return [...nomes, ...extras].slice(0, n).map((nome, i) => total(i + 1, nome, (n - i) * 10000))
}

function renderPizza(totais: TotalPorCategoria[]) {
  const resultado = render(<PizzaCategorias fatias={montarPizza(totais)} />)
  const fatias = Array.from(resultado.container.querySelectorAll('path'))
  return { ...resultado, fatias }
}

function legenda() {
  return within(screen.getByRole('list', { name: 'Legenda' })).getAllByRole('listitem')
}

describe('PizzaCategorias — leitura em repouso', () => {
  afterEach(cleanup)

  it('mostra uma linha de legenda por fatia, com nome e percentual', () => {
    renderPizza(TRES)

    const itens = legenda()
    expect(itens).toHaveLength(3)
    expect(itens[0]?.textContent).toContain('Casa')
    expect(itens[0]?.textContent).toContain('50%')
    expect(itens[2]?.textContent).toContain('Lazer')
    expect(itens[2]?.textContent).toContain('25%')
  })

  // A legenda não repete o valor em R$: ele já está no ranking ao lado, e o
  // E2E localiza a linha do ranking justamente por ser o item com "R$".
  it('não mostra valor em R$ na legenda — o valor fica na dica e no ranking', () => {
    renderPizza(TRES)

    for (const item of legenda()) expect(item.textContent).not.toMatch(/R\$/)
  })

  it('descreve as fatias no nome acessível do gráfico', () => {
    renderPizza(TRES)

    expect(
      screen.getByRole('img', {
        name: 'Divisão dos gastos por categoria: Casa 50%, Mercado 25%, Lazer 25%'
      })
    ).toBeTruthy()
  })

  it('conta na meta as categorias do mês, inclusive as agrupadas em Outros', () => {
    renderPizza(categorias(7))

    expect(screen.getByText('7 categorias')).toBeTruthy()
    expect(legenda()).toHaveLength(6)
  })

  it('pinta cada fatia com a cor da categoria, e Outros pelo token', () => {
    const { fatias } = renderPizza(categorias(7))

    expect(fatias).toHaveLength(6)
    expect(fatias[0]?.getAttribute('fill')).toBe('#5a4a8a')
    // Outros não leva cor de categoria inline: a cor vem de --fatia-outros.
    expect(fatias[5]?.getAttribute('fill')).toBeNull()
  })

  it('mostra o estado vazio quando o mês não tem gasto', () => {
    render(<PizzaCategorias fatias={[]} />)

    expect(screen.getByText('Nenhum gasto neste mês.')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })
})

describe('PizzaCategorias — ao passar o mouse', () => {
  afterEach(cleanup)

  it('na fatia, mostra valor, nome e percentual, e esmaece as outras', () => {
    const { fatias } = renderPizza(TRES)

    fireEvent.mouseEnter(fatias[1]!)

    const dica = screen.getByRole('tooltip')
    expect(dica.textContent).toMatch(/R\$\s100,00/)
    expect(dica.textContent).toContain('Mercado · 25%')
    expect(fatias.map((f) => f.getAttribute('data-apagada'))).toEqual(['true', 'false', 'true'])
    expect(legenda().map((i) => i.getAttribute('data-ativa'))).toEqual(['false', 'true', 'false'])
  })

  it('ao sair, some com a dica e devolve as cores', () => {
    const { fatias } = renderPizza(TRES)

    fireEvent.mouseEnter(fatias[1]!)
    fireEvent.mouseLeave(fatias[1]!)

    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(fatias.map((f) => f.getAttribute('data-apagada'))).toEqual(['false', 'false', 'false'])
  })

  it('na linha da legenda, destaca a fatia correspondente', () => {
    const { fatias } = renderPizza(TRES)

    fireEvent.mouseEnter(legenda()[0]!)

    expect(screen.getByRole('tooltip').textContent).toMatch(/R\$\s200,00/)
    expect(fatias.map((f) => f.getAttribute('data-apagada'))).toEqual(['false', 'true', 'true'])
  })

  it('em Outros, a dica diz quais categorias foram agrupadas', () => {
    const { fatias } = renderPizza(categorias(7))

    fireEvent.mouseEnter(fatias[5]!)

    expect(screen.getByRole('tooltip').textContent).toContain('Inclui Saúde e Presentes')
  })

  // A dica mora dentro do quadro do gráfico; uma lista longa a empurraria
  // para fora do card.
  it('com muitas agrupadas, a dica resume em vez de listar todas', () => {
    const { fatias } = renderPizza(categorias(10))

    fireEvent.mouseEnter(fatias[5]!)

    expect(screen.getByRole('tooltip').textContent).toContain(
      'Inclui Saúde, Presentes, Pets e mais 2'
    )
  })

  // Na metade oposta, a dica nunca cobre a fatia que o leitor está olhando.
  it('abre a dica na metade oposta à da fatia', () => {
    // Casa ocupa de 0° a 270° (centro na metade de baixo); Mercado, de 270° a
    // 360° (centro na metade de cima).
    const { fatias } = renderPizza([total(1, 'Casa', 30000), total(2, 'Mercado', 10000)])

    fireEvent.mouseEnter(fatias[0]!)
    expect(screen.getByRole('tooltip').getAttribute('data-posicao')).toBe('acima')

    fireEvent.mouseLeave(fatias[0]!)
    fireEvent.mouseEnter(fatias[1]!)
    expect(screen.getByRole('tooltip').getAttribute('data-posicao')).toBe('abaixo')
  })
})
