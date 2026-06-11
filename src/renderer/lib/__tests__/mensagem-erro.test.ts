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
