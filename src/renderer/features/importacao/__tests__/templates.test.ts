import { describe, it, expect } from 'vitest'
import { TEMPLATES, validarHeader, converterLinhas, conteudoDoModelo } from '../templates'

function template(id: string) {
  const t = TEMPLATES.find((t) => t.id === id)
  if (!t) throw new Error(`template ${id} não existe`)
  return t
}

describe('templates de importação CSV', () => {
  it('todo template tem exemplo consistente com as colunas e que converte limpo', () => {
    for (const t of TEMPLATES) {
      expect(t.exemplo).toHaveLength(t.colunas.length)
      expect(() => t.converter([...t.exemplo])).not.toThrow()
    }
  })

  it('validarHeader aceita o proprio header com variação de caixa e espaços', () => {
    const t = template('gastoForaCartao')
    expect(() =>
      validarHeader(t, ['Descricao', ' CATEGORIA ', 'forma_pagamento', 'valor', 'data'])
    ).not.toThrow()
  })

  it('validarHeader rejeita header com colunas trocadas ou faltando', () => {
    const t = template('gastoForaCartao')
    expect(() => validarHeader(t, ['descricao', 'valor'])).toThrow(/tally-gastos\.csv/)
    expect(() =>
      validarHeader(t, ['categoria', 'descricao', 'forma_pagamento', 'valor', 'data'])
    ).toThrow(/Esperado/)
  })

  it('gasto fora de cartão converte valor pt-BR para centavos', () => {
    const t = template('gastoForaCartao')
    const linha = t.converter(['Almoço', 'Alimentação', 'Pix', '1.234,56', '2026-07-10'])
    expect(linha).toMatchObject({ tipo: 'gastoForaCartao', valorCentavos: 123456 })
  })

  it('parcelada em andamento calcula o valor restante = valor da parcela x restantes', () => {
    const t = template('parceladaEmAndamento')
    const linha = t.converter([
      'Notebook',
      'Eletrônicos',
      'Inter',
      '12',
      '7',
      '250,00',
      '2026-01-15'
    ])
    // 12 - 7 + 1 = 6 parcelas restantes x 25000 centavos
    expect(linha).toMatchObject({
      tipo: 'parceladaEmAndamento',
      totalParcelas: 12,
      parcelaAtual: 7,
      valorRestanteCentavos: 150000
    })
  })

  it('recebimento avulso com data_recebida vazia vira null', () => {
    const t = template('recebimentoAvulso')
    const linha = t.converter(['Freela', '500,00', '2026-07-15', ''])
    expect(linha).toMatchObject({ tipo: 'recebimentoAvulso', dataRecebida: null })
  })

  it('converterLinhas separa válidas de erros com número da linha do arquivo', () => {
    const t = template('gastoForaCartao')
    const resultado = converterLinhas(t, [
      ['Ok', 'Alimentação', 'Pix', '10,00', '2026-07-10'],
      ['Valor ruim', 'Alimentação', 'Pix', 'abc', '2026-07-10'],
      ['Forma ruim', 'Alimentação', 'Cheque', '10,00', '2026-07-10'],
      ['Data ruim', 'Alimentação', 'Pix', '10,00', '10/07/2026']
    ])

    expect(resultado.validas).toHaveLength(1)
    expect(resultado.erros.map((e) => e.linha)).toEqual([3, 4, 5])
    expect(resultado.erros[0].motivo).toMatch(/inválido/i)
  })

  it('conteudoDoModelo gera header + exemplo com ponto-e-virgula', () => {
    const t = template('rendaRecorrente')
    expect(conteudoDoModelo(t)).toBe(
      'nome;valor;dia_esperado;data_inicio\nBolsa PET;1.200,00;5;2026-07-01\n'
    )
  })
})
