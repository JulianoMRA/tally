import { describe, it, expect } from 'vitest'
import type { StatusFatura } from '@domain/entities/fatura'
import { contextoDoParcial } from '../descrever-parcial'

function fatura(totalCentavos: number, pagoParcialCentavos: number, status: StatusFatura) {
  return { totalCentavos, pagoParcialCentavos, fatura: { status } }
}

/**
 * RN-10 na tela: com pagamento parcial, o número da fatura passa a ser o que
 * falta pagar, e o total vira contexto. Sem o contexto, o card do trilho
 * mostraria R$ 600 numa fatura de R$ 800 sem dizer para onde foram os R$ 200.
 */
describe('contextoDoParcial', () => {
  it('sem pagamento parcial, não há contexto a mostrar', () => {
    expect(contextoDoParcial(fatura(80000, 0, { kind: 'Fechada' }))).toBeNull()
  })

  it('em fatura a pagar, diz quanto foi pago e de quanto', () => {
    const texto = contextoDoParcial(fatura(80000, 20000, { kind: 'Fechada' }))

    // Regex e não string exata: formatBRL usa espaço não-quebrável após "R$".
    expect(texto).toMatch(/^R\$\s*200,00 pagos de R\$\s*800,00$/)
  })

  it('segue dizendo a verdade quando o pago passa do total', () => {
    const texto = contextoDoParcial(fatura(10000, 50000, { kind: 'Aberta' }))

    expect(texto).toMatch(/^R\$\s*500,00 pagos de R\$\s*100,00$/)
  })

  // "R$ 200,00 pagos de R$ 800,00" ao lado do selo "Paga" se lê como se só uma
  // parte tivesse sido paga. A faixa do painel já trata o caso ("Restante
  // pago"); no trilho e no histórico o contexto dizia o contrário do selo.
  it('em fatura paga, diz só quanto foi em pagamentos parciais', () => {
    const texto = contextoDoParcial(fatura(80000, 20000, { kind: 'Paga', pagaEm: '2026-09-20' }))

    expect(texto).toMatch(/^R\$\s*200,00 em pagamentos parciais$/)
  })
})
