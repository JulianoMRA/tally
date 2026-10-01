import { describe, expect, it } from 'vitest'
import {
  calcularRestanteDaFatura,
  podeExcluirPagamentoParcial,
  podeRegistrarPagamentoParcial,
  type PagamentoParaRegistrar
} from '../pagamento-parcial'

/**
 * RN-10 — quanto falta pagar de uma fatura.
 *
 * O app só sabia pagar a fatura inteira: pagar era um status com uma data, e o
 * total era sempre a soma das parcelas (RN-07). Quem pagava uma parte antes do
 * vencimento não tinha onde registrar, e o improviso — lançar o pagamento como
 * renda avulsa — acertava a sobra do mês e deixava a fatura mostrando um valor
 * que o banco já não cobrava.
 */
describe('calcularRestanteDaFatura', () => {
  it('sem pagamento parcial, falta pagar o total', () => {
    expect(calcularRestanteDaFatura(80000, 0)).toEqual({
      totalCentavos: 80000,
      pagoParcialCentavos: 0,
      restanteCentavos: 80000,
      excedenteCentavos: 0
    })
  })

  it('abate do total o que já foi pago', () => {
    expect(calcularRestanteDaFatura(80000, 20000)).toEqual({
      totalCentavos: 80000,
      pagoParcialCentavos: 20000,
      restanteCentavos: 60000,
      excedenteCentavos: 0
    })
  })

  it('parciais iguais ao total não deixam nada a pagar, nem nada a mais', () => {
    const saldo = calcularRestanteDaFatura(80000, 80000)

    expect(saldo.restanteCentavos).toBe(0)
    expect(saldo.excedenteCentavos).toBe(0)
  })

  // Só acontece em fatura Aberta, quando uma despesa é excluída ou reduzida
  // depois do pagamento. Valor negativo não é representável no projeto, então a
  // diferença ganha nome próprio em vez de virar um restante abaixo de zero.
  it('parciais acima do total zeram o restante e a diferença vira pago a mais', () => {
    expect(calcularRestanteDaFatura(40000, 50000)).toEqual({
      totalCentavos: 40000,
      pagoParcialCentavos: 50000,
      restanteCentavos: 0,
      excedenteCentavos: 10000
    })
  })

  it('fatura sem compra e sem pagamento fica zerada', () => {
    const saldo = calcularRestanteDaFatura(0, 0)

    expect(saldo.restanteCentavos).toBe(0)
    expect(saldo.excedenteCentavos).toBe(0)
  })

  // A mensagem nomeia o campo: os dois argumentos são números, e "valor
  // inválido" sozinho não diria qual das duas somas veio errada do banco.
  it.each([
    ['total negativo', -1, 0, /^totalCentavos deve ser inteiro/],
    ['pago negativo', 100, -1, /^pagoParcialCentavos deve ser inteiro/],
    ['total fracionário', 100.5, 0, /^totalCentavos deve ser inteiro/],
    ['pago fracionário', 100, 0.5, /^pagoParcialCentavos deve ser inteiro/],
    ['total que não é número', Number.NaN, 0, /^totalCentavos deve ser inteiro/]
  ])('recusa %s em vez de devolver uma conta errada', (_caso, total, pago, mensagem) => {
    expect(() => calcularRestanteDaFatura(total, pago)).toThrow(mensagem)
  })
})

function pedido(over: Partial<PagamentoParaRegistrar> = {}): PagamentoParaRegistrar {
  return {
    statusFatura: 'Aberta',
    restanteCentavos: 60000,
    valorCentavos: 20000,
    dataPagamento: '2026-10-10',
    ...over
  }
}

/**
 * RN-10 — quem aceita pagamento parcial.
 *
 * Aberta e Fechada aceitam; Paga não. O valor não passa do que falta pagar, e
 * na fatura Fechada o valor que quita o restante não é pagamento parcial: é
 * "Marcar como paga", que registra a quitação e marca as parcelas (RN-06).
 */
describe('podeRegistrarPagamentoParcial', () => {
  it('aceita em fatura Aberta', () => {
    expect(podeRegistrarPagamentoParcial(pedido())).toEqual({ ok: true })
  })

  it('aceita em fatura Fechada, abaixo do que falta pagar', () => {
    expect(podeRegistrarPagamentoParcial(pedido({ statusFatura: 'Fechada' }))).toEqual({
      ok: true
    })
  })

  it('recusa em fatura Paga', () => {
    expect(podeRegistrarPagamentoParcial(pedido({ statusFatura: 'Paga' }))).toMatchObject({
      ok: false,
      motivo: 'fatura-paga'
    })
  })

  // A fatura vem antes do valor de propósito, como em `podeMarcarOcorrenciaPaga`:
  // quando os dois valem, a mensagem precisa apontar o dono da decisão.
  it('acusa a fatura paga antes de acusar o valor, quando os dois valem', () => {
    const resultado = podeRegistrarPagamentoParcial(
      pedido({ statusFatura: 'Paga', valorCentavos: 0, dataPagamento: '' })
    )

    expect(resultado).toMatchObject({ ok: false, motivo: 'fatura-paga' })
  })

  it.each([
    ['zero', 0],
    ['negativo', -100],
    ['fracionário', 10.5],
    ['que não é número', Number.NaN]
  ])('recusa valor %s', (_caso, valorCentavos) => {
    expect(podeRegistrarPagamentoParcial(pedido({ valorCentavos }))).toMatchObject({
      ok: false,
      motivo: 'valor-invalido'
    })
  })

  it('aceita o menor valor possível, de um centavo', () => {
    expect(podeRegistrarPagamentoParcial(pedido({ valorCentavos: 1 }))).toEqual({ ok: true })
  })

  it.each([
    ['vazia', ''],
    ['em formato brasileiro', '10/10/2026'],
    ['com dia que o mês não tem', '2026-02-30'],
    ['com dia 31 em mês de 30', '2026-04-31'],
    ['com mês 13', '2026-13-01'],
    ['com mês zero', '2026-00-10'],
    ['com dia zero', '2026-10-00'],
    ['com lixo depois da data', '2026-10-10T12:00'],
    ['com lixo antes da data', 'em 2026-10-10']
  ])('recusa data %s', (_caso, dataPagamento) => {
    expect(podeRegistrarPagamentoParcial(pedido({ dataPagamento }))).toMatchObject({
      ok: false,
      motivo: 'data-invalida'
    })
  })

  // As bordas do calendário: o primeiro e o último mês, o primeiro e o último
  // dia. Um `<` trocado por `<=` recusaria janeiro inteiro sem nenhum outro
  // teste notar.
  it.each([
    ['o primeiro dia do ano', '2026-01-01'],
    ['o último dia do ano', '2026-12-31'],
    ['o último dia de um mês de 30', '2026-04-30'],
    ['28 de fevereiro', '2026-02-28']
  ])('aceita %s', (_caso, dataPagamento) => {
    expect(podeRegistrarPagamentoParcial(pedido({ dataPagamento }))).toEqual({ ok: true })
  })

  it('aceita 29 de fevereiro em ano bissexto e recusa fora dele', () => {
    expect(podeRegistrarPagamentoParcial(pedido({ dataPagamento: '2028-02-29' }))).toEqual({
      ok: true
    })
    expect(podeRegistrarPagamentoParcial(pedido({ dataPagamento: '2027-02-29' }))).toMatchObject({
      ok: false,
      motivo: 'data-invalida'
    })
  })

  it('recusa valor acima do que falta pagar', () => {
    const resultado = podeRegistrarPagamentoParcial(
      pedido({ restanteCentavos: 60000, valorCentavos: 60001 })
    )

    expect(resultado).toMatchObject({ ok: false, motivo: 'excede-restante' })
  })

  it('recusa qualquer valor quando não falta nada', () => {
    const resultado = podeRegistrarPagamentoParcial(
      pedido({ restanteCentavos: 0, valorCentavos: 1 })
    )

    expect(resultado).toMatchObject({ ok: false, motivo: 'excede-restante' })
  })

  // Fatura Aberta ainda não pode ser marcada como paga (RN-06), então pagar
  // tudo o que há nela até agora é um pagamento parcial como outro qualquer:
  // novas compras podem entrar depois.
  it('em fatura Aberta, aceita o valor igual ao que falta pagar', () => {
    const resultado = podeRegistrarPagamentoParcial(
      pedido({ statusFatura: 'Aberta', restanteCentavos: 60000, valorCentavos: 60000 })
    )

    expect(resultado).toEqual({ ok: true })
  })

  // Aceitar deixaria a fatura Fechada, sem nada a pagar e sem estar paga — com
  // as parcelas pendentes e os avisos de vencimento ligados.
  it('em fatura Fechada, o valor igual ao que falta é quitação, não pagamento parcial', () => {
    const resultado = podeRegistrarPagamentoParcial(
      pedido({ statusFatura: 'Fechada', restanteCentavos: 60000, valorCentavos: 60000 })
    )

    expect(resultado).toMatchObject({ ok: false, motivo: 'quita-a-fatura' })
  })

  it('em fatura Fechada, um centavo a menos que o restante ainda é parcial', () => {
    const resultado = podeRegistrarPagamentoParcial(
      pedido({ statusFatura: 'Fechada', restanteCentavos: 60000, valorCentavos: 59999 })
    )

    expect(resultado).toEqual({ ok: true })
  })

  // Acima do restante é sempre excesso, inclusive em Fechada: "quitação" só
  // vale para o valor exato.
  it('em fatura Fechada, valor acima do que falta é excesso, não quitação', () => {
    const resultado = podeRegistrarPagamentoParcial(
      pedido({ statusFatura: 'Fechada', restanteCentavos: 60000, valorCentavos: 60001 })
    )

    expect(resultado).toMatchObject({ ok: false, motivo: 'excede-restante' })
  })

  // A mensagem vai para o diálogo de registro e para o erro do main: uma recusa
  // sem texto viraria um botão desabilitado sem explicação.
  it.each([
    ['fatura-paga', pedido({ statusFatura: 'Paga' }), /Reabra a fatura/],
    ['valor-invalido', pedido({ valorCentavos: 0 }), /maior que zero/],
    ['data-invalida', pedido({ dataPagamento: '2026-02-30' }), /2026-02-30/],
    ['excede-restante', pedido({ valorCentavos: 60001 }), /falta pagar/],
    [
      'quita-a-fatura',
      pedido({ statusFatura: 'Fechada', valorCentavos: 60000 }),
      /Marcar como paga/
    ]
  ] as const)('a recusa %s diz o que fazer', (motivo, entrada, texto) => {
    const resultado = podeRegistrarPagamentoParcial(entrada)

    expect(resultado).toMatchObject({ ok: false, motivo })
    expect(resultado.ok === false && resultado.erro).toMatch(texto)
  })
})

/**
 * RN-10 — excluir pagamento parcial.
 *
 * É a única correção desta versão: não há edição, então errar o valor se
 * resolve excluindo e registrando de novo. Fatura Paga é imutável (RF-FAT-04) e
 * a saída é a mesma de sempre: reabrir (RF-FAT-05).
 */
describe('podeExcluirPagamentoParcial', () => {
  it('aceita em fatura Aberta', () => {
    expect(podeExcluirPagamentoParcial('Aberta')).toEqual({ ok: true })
  })

  it('aceita em fatura Fechada', () => {
    expect(podeExcluirPagamentoParcial('Fechada')).toEqual({ ok: true })
  })

  it('recusa em fatura Paga, apontando a reabertura', () => {
    const resultado = podeExcluirPagamentoParcial('Paga')

    expect(resultado).toMatchObject({ ok: false, motivo: 'fatura-paga' })
    expect(resultado.ok === false && resultado.erro).toMatch(/Reabra a fatura/)
  })
})
