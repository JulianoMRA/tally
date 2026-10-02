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
      pagoParcialFaturasCentavos={0}
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
        pagoParcialFaturasCentavos={0}
        totalForaCartaoCentavos={0}
        qtdCartoes={0}
        qtdGastosForaCartao={0}
      />
    )

    expect(container.querySelector('[class*="heroBarra"]')).toBeNull()
    expect(screen.getAllByText(/^R\$\s*0,00$/).length).toBeGreaterThan(0)
  })
})

/**
 * RN-08 com pagamento parcial (RN-10). A fatia "Faturas" passa a somar o que as
 * faturas pesam no mês — o que falta pagar de cada uma —, e o hero precisa
 * dizer para onde foi a diferença: sem a nota, a fatia mostraria R$ 600 num mês
 * em que o card de faturas soma R$ 800 de compras.
 */
describe('SaldoHero — pagamento parcial', () => {
  afterEach(cleanup)

  it('a nota das faturas diz quanto já foi pago, como a das entradas diz o que já entrou', () => {
    renderHero({ totalFaturasCentavos: 60000, pagoParcialFaturasCentavos: 20000 })

    expect(screen.getByText(/^2 cartões · R\$\s*200,00\sjá\spagos$/)).toBeTruthy()
  })

  // Na janela padrão a nota não cabe numa linha, e com espaço comum quebrava em
  // "… já / pagos". Presa por espaços não-quebráveis, a quebra cai no "·".
  it('"R$ X já pagos" não quebra no meio', () => {
    renderHero({ totalFaturasCentavos: 60000, pagoParcialFaturasCentavos: 20000 })

    const nota = screen.getByText(/já\spagos$/)
    expect(nota.textContent).toMatch(/· R\$ 200,00 já pagos$/)
  })

  it('sem pagamento parcial, a nota das faturas é só a contagem de cartões', () => {
    renderHero()

    expect(screen.getByText('2 cartões')).toBeTruthy()
    expect(screen.queryByText(/já\spagos/)).toBeNull()
  })

  // "Integralmente" deixa de ser verdade assim que um pagamento parcial abate
  // uma fatura do mês. O texto de apoio é a única explicação da regra na tela.
  it('o texto de apoio diz que os pagamentos parciais foram descontados', () => {
    renderHero({ totalFaturasCentavos: 60000, pagoParcialFaturasCentavos: 20000 })

    expect(screen.getByText(/descontados os pagamentos parciais/)).toBeTruthy()
    expect(screen.getByText(/mesmo em fatura não paga/)).toBeTruthy()
    expect(screen.queryByText(/integralmente/)).toBeNull()
  })

  it('sem pagamento parcial, o texto de apoio segue dizendo "integralmente"', () => {
    renderHero()

    expect(screen.getByText(/Saídas contam integralmente, mesmo em fatura não paga/)).toBeTruthy()
    expect(screen.queryByText(/pagamentos parciais/)).toBeNull()
  })

  it('a fatia das faturas mostra o valor recebido, sem refazer a conta', () => {
    renderHero({ totalFaturasCentavos: 60000, pagoParcialFaturasCentavos: 20000 })

    const fatia = screen.getByText('Faturas').parentElement
    expect(fatia?.textContent).toMatch(/Faturas\s*R\$\s*600,00/)
  })
})
