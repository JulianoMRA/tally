import { describe, it, expect } from 'vitest'
import { importarCsvInputSchema, LIMITE_LINHAS_IMPORTACAO } from '../importacao'

function linhaValida(): unknown {
  return {
    tipo: 'gastoForaCartao',
    descricao: 'Mercado',
    categoriaNome: 'Casa',
    formaPagamento: 'Pix',
    valorCentavos: 1234,
    data: '2026-08-01'
  }
}

describe('importarCsvInputSchema — tamanho do lote', () => {
  // Todo o resto do app tem limite: descrição em 120, parcelas em 360, retenção
  // de backup em 100. O lote de importação era o único campo sem teto, e ele
  // vira uma transação SQLite única — o `importarLinhas` é all-or-nothing.
  // O arquivo vem de terceiro, que é justamente o caso de uso do import.

  it('aceita um lote no limite', () => {
    const linhas = Array.from({ length: LIMITE_LINHAS_IMPORTACAO }, linhaValida)

    expect(() => importarCsvInputSchema.parse({ linhas })).not.toThrow()
  })

  it('recusa um lote acima do limite, com mensagem que diz o teto', () => {
    const linhas = Array.from({ length: LIMITE_LINHAS_IMPORTACAO + 1 }, linhaValida)

    expect(() => importarCsvInputSchema.parse({ linhas })).toThrow(
      new RegExp(String(LIMITE_LINHAS_IMPORTACAO))
    )
  })

  it('continua recusando lote vazio', () => {
    expect(() => importarCsvInputSchema.parse({ linhas: [] })).toThrow(/nenhuma linha/i)
  })
})
