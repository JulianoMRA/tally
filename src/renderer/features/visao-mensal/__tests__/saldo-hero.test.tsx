// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { BalancoMensal } from '@shared/ipc/visao-mensal'
import { SaldoHero } from '../SaldoHero'

function totais(overrides: Partial<BalancoMensal> = {}): BalancoMensal {
  return {
    totalSaidasCentavos: 121820,
    totalEntradasRecebidasCentavos: 0,
    totalEntradasProjetadasCentavos: 240000,
    saldoRealizadoCentavos: -121820,
    saldoProjetadoCentavos: 118180,
    ...overrides
  }
}

function renderHero(props: Partial<React.ComponentProps<typeof SaldoHero>> = {}) {
  return render(
    <SaldoHero
      totais={totais()}
      totalFaturasCentavos={100000}
      totalForaCartaoCentavos={21820}
      qtdCartoes={2}
      qtdGastosForaCartao={4}
      {...props}
    />
  )
}

describe('SaldoHero — RN-08 preservado', () => {
  afterEach(cleanup)

  // Decisão de produto de ago/2026: a regra do RN-08 fica intacta e o rótulo
  // nunca diz "Realizado", porque a palavra sugere um regime de caixa que a
  // regra não tem — as saídas contam integralmente mesmo em fatura não paga.
  it('rotula a linha de apoio como "Só entradas recebidas", nunca como "Realizado"', () => {
    renderHero()

    expect(screen.getByText(/Só entradas recebidas/)).toBeTruthy()
    expect(screen.queryByText(/^Realizado/)).toBeNull()
  })

  it('explicita que saídas contam mesmo em fatura não paga', () => {
    renderHero()

    expect(screen.getByText(/mesmo em fatura não paga/)).toBeTruthy()
  })

  it('mostra o projetado como número principal e o realizado na linha de apoio', () => {
    renderHero()

    // Regex e não string exata: formatBRL usa espaço não-quebrável após "R$".
    expect(screen.getByText(/^R\$\s*1\.181,80$/)).toBeTruthy()
    expect(screen.getByText(/^-R\$\s*1\.218,20$/)).toBeTruthy()
  })
})

describe('SaldoHero — composição', () => {
  afterEach(cleanup)

  it('quebra o mês nas três grandezas que formam o saldo', () => {
    renderHero()

    expect(screen.getByText('Entrou / vai entrar')).toBeTruthy()
    expect(screen.getByText('Faturas')).toBeTruthy()
    expect(screen.getByText('Fora do cartão')).toBeTruthy()
  })

  it('pluraliza cartão e lançamento conforme a contagem', () => {
    renderHero({ qtdCartoes: 1, qtdGastosForaCartao: 1 })

    expect(screen.getByText('1 cartão')).toBeTruthy()
    expect(screen.getByText('1 lançamento')).toBeTruthy()
  })

  it('usa "cartões" com til no plural, não "cartãoões"', () => {
    renderHero({ qtdCartoes: 3 })

    expect(screen.getByText('3 cartões')).toBeTruthy()
  })

  // Mês sem nada cadastrado: dividir pelas fatias zeradas daria NaN% de
  // largura em cada segmento, e a barra sumiria com estilo inválido.
  it('omite a barra de composição quando o mês está zerado', () => {
    const { container } = render(
      <SaldoHero
        totais={totais({
          totalEntradasProjetadasCentavos: 0,
          totalEntradasRecebidasCentavos: 0,
          saldoProjetadoCentavos: 0,
          saldoRealizadoCentavos: 0,
          totalSaidasCentavos: 0
        })}
        totalFaturasCentavos={0}
        totalForaCartaoCentavos={0}
        qtdCartoes={0}
        qtdGastosForaCartao={0}
      />
    )

    expect(container.querySelector('[class*="heroBarra"]')).toBeNull()
    expect(screen.getAllByText(/^R\$\s*0,00$/).length).toBeGreaterThan(0)
  })
})
