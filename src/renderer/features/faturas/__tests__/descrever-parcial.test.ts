import { describe, it, expect } from 'vitest'
import { contextoDoParcial } from '../descrever-parcial'

/**
 * RN-10 na tela: com pagamento parcial, o número da fatura passa a ser o que
 * falta pagar, e o total vira contexto. Sem o contexto, o card do trilho
 * mostraria R$ 600 numa fatura de R$ 800 sem dizer para onde foram os R$ 200.
 */
describe('contextoDoParcial', () => {
  it('sem pagamento parcial, não há contexto a mostrar', () => {
    expect(contextoDoParcial({ totalCentavos: 80000, pagoParcialCentavos: 0 })).toBeNull()
  })

  it('com parcial, diz quanto foi pago e de quanto', () => {
    const texto = contextoDoParcial({ totalCentavos: 80000, pagoParcialCentavos: 20000 })

    // Regex e não string exata: formatBRL usa espaço não-quebrável após "R$".
    expect(texto).toMatch(/^R\$\s*200,00 pagos de R\$\s*800,00$/)
  })

  it('segue dizendo a verdade quando o pago passa do total', () => {
    const texto = contextoDoParcial({ totalCentavos: 10000, pagoParcialCentavos: 50000 })

    expect(texto).toMatch(/^R\$\s*500,00 pagos de R\$\s*100,00$/)
  })
})
