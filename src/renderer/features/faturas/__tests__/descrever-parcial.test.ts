import { describe, it, expect } from 'vitest'
import { contextoDoParcial, quitadaPorParciais } from '../descrever-parcial'

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

/**
 * Fatura cujos pagamentos parciais já cobrem o total: não há o que pagar, só o
 * que marcar. É o sinal que desliga "vence em N dias" e "vencida há N dias".
 */
describe('quitadaPorParciais', () => {
  it('é true quando os parciais cobrem o total', () => {
    expect(quitadaPorParciais({ pagoParcialCentavos: 80000, restanteCentavos: 0 })).toBe(true)
  })

  it('é false enquanto falta pagar', () => {
    expect(quitadaPorParciais({ pagoParcialCentavos: 20000, restanteCentavos: 60000 })).toBe(false)
  })

  // Fatura sem compra também tem restante zero, e nunca foi paga por ninguém:
  // tratá-la como quitada desligaria os avisos de uma fatura vazia de cartão
  // ativo, que hoje avisam.
  it('é false para fatura zerada, sem pagamento nenhum', () => {
    expect(quitadaPorParciais({ pagoParcialCentavos: 0, restanteCentavos: 0 })).toBe(false)
  })
})
