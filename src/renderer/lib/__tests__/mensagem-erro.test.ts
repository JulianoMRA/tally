import { describe, expect, it } from 'vitest'
import { mensagemErro } from '../mensagem-erro'

describe('mensagemErro', () => {
  it('remove o prefixo que o Electron adiciona a erros vindos do IPC', () => {
    const e = new Error(
      "Error invoking remote method 'despesa:excluir': Error: Despesa #3 possui parcela(s) paga(s): 1. Exclusão bloqueada."
    )
    expect(mensagemErro(e, 'Erro ao excluir.')).toBe(
      'Despesa #3 possui parcela(s) paga(s): 1. Exclusão bloqueada.'
    )
  })

  it('remove o prefixo mesmo sem o "Error:" interno', () => {
    const e = new Error("Error invoking remote method 'cartao:create': cartão inválido")
    expect(mensagemErro(e, 'Erro.')).toBe('cartão inválido')
  })

  it('devolve a mensagem intacta quando não há prefixo de IPC', () => {
    const e = new Error('Cartão #9 não encontrado')
    expect(mensagemErro(e, 'Erro.')).toBe('Cartão #9 não encontrado')
  })

  it('usa o fallback quando o valor não é Error', () => {
    expect(mensagemErro('boom', 'Erro ao salvar.')).toBe('Erro ao salvar.')
    expect(mensagemErro(undefined, 'Erro ao salvar.')).toBe('Erro ao salvar.')
  })

  it('usa o fallback quando a mensagem é vazia', () => {
    expect(mensagemErro(new Error(''), 'Erro ao salvar.')).toBe('Erro ao salvar.')
  })

  it('usa o fallback quando só resta o prefixo', () => {
    const e = new Error("Error invoking remote method 'x:y': ")
    expect(mensagemErro(e, 'Erro ao salvar.')).toBe('Erro ao salvar.')
  })
})

// Os handlers do main validam com `.parse()`, e no zod v4 a `message` do
// ZodError e o JSON completo dos issues. Sem tratamento, uma divergencia entre
// a validacao do formulario e a do main despejava esse JSON no toast.
describe('mensagemErro com ZodError vindo do IPC', () => {
  const issuesJson = JSON.stringify(
    [
      {
        code: 'too_big',
        maximum: 9007199254740991,
        note: 'Integers must be within the safe integer range.',
        origin: 'int',
        inclusive: true,
        path: ['valorCentavos'],
        message: 'Too big: expected int to be <=9007199254740991'
      }
    ],
    null,
    2
  )

  it('extrai a mensagem do issue em vez de despejar o JSON', () => {
    const e = new Error(
      `Error invoking remote method 'despesa:criarUnicaCredito': Error: ${issuesJson}`
    )
    expect(mensagemErro(e, 'Erro ao salvar.')).toBe(
      'valorCentavos: Too big: expected int to be <=9007199254740991'
    )
  })

  it('preserva as mensagens em portugues dos schemas do projeto', () => {
    const json = JSON.stringify([
      { code: 'too_small', path: ['valorCentavos'], message: 'Valor deve ser maior que zero' }
    ])
    const e = new Error(`Error invoking remote method 'x:y': Error: ${json}`)
    expect(mensagemErro(e, 'Erro.')).toBe('valorCentavos: Valor deve ser maior que zero')
  })

  it('junta varios issues numa linha por campo', () => {
    const json = JSON.stringify([
      { code: 'too_small', path: ['descricao'], message: 'Descrição é obrigatória' },
      { code: 'too_small', path: ['valorCentavos'], message: 'Valor deve ser maior que zero' }
    ])
    const e = new Error(`Error invoking remote method 'x:y': Error: ${json}`)
    expect(mensagemErro(e, 'Erro.')).toBe(
      'descricao: Descrição é obrigatória; valorCentavos: Valor deve ser maior que zero'
    )
  })

  it('omite o prefixo de campo quando o issue nao tem caminho', () => {
    const json = JSON.stringify([{ code: 'custom', path: [], message: 'Payload inválido' }])
    const e = new Error(`Error invoking remote method 'x:y': Error: ${json}`)
    expect(mensagemErro(e, 'Erro.')).toBe('Payload inválido')
  })

  it('usa o caminho completo em campo aninhado', () => {
    const json = JSON.stringify([
      { code: 'too_small', path: ['linhas', 3, 'valorCentavos'], message: 'Valor inválido' }
    ])
    const e = new Error(`Error invoking remote method 'x:y': Error: ${json}`)
    expect(mensagemErro(e, 'Erro.')).toBe('linhas.3.valorCentavos: Valor inválido')
  })

  it('nao confunde uma mensagem comum que apenas parece JSON', () => {
    const e = new Error('Error: [rascunho] não encontrado')
    expect(mensagemErro(e, 'Erro.')).toBe('Error: [rascunho] não encontrado')
  })

  it('cai no texto cru quando o JSON nao tem o formato de issue', () => {
    const e = new Error(`Error invoking remote method 'x:y': Error: [1, 2, 3]`)
    expect(mensagemErro(e, 'Erro.')).toBe('[1, 2, 3]')
  })
})
