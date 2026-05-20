import { describe, it, expect } from 'vitest'
import { categoriaInputSchema } from '../categoria'

describe('categoriaInputSchema', () => {
  const inputValido = {
    nome: 'Mercado',
    tipo: 'Despesa' as const,
    cor: '#4caf50'
  }

  it('aceita input válido completo', () => {
    expect(() => categoriaInputSchema.parse(inputValido)).not.toThrow()
  })

  it('aceita todos os tipos válidos', () => {
    expect(() => categoriaInputSchema.parse({ ...inputValido, tipo: 'Despesa' })).not.toThrow()
    expect(() => categoriaInputSchema.parse({ ...inputValido, tipo: 'Renda' })).not.toThrow()
    expect(() => categoriaInputSchema.parse({ ...inputValido, tipo: 'Ambos' })).not.toThrow()
  })

  it('aceita cores minúsculas e maiúsculas', () => {
    expect(() => categoriaInputSchema.parse({ ...inputValido, cor: '#a0b1c2' })).not.toThrow()
    expect(() => categoriaInputSchema.parse({ ...inputValido, cor: '#AABBCC' })).not.toThrow()
  })

  it('rejeita nome vazio', () => {
    expect(() => categoriaInputSchema.parse({ ...inputValido, nome: '' })).toThrow()
  })

  it('rejeita nome apenas com espaços', () => {
    expect(() => categoriaInputSchema.parse({ ...inputValido, nome: '   ' })).toThrow()
  })

  it('rejeita nome com mais de 60 caracteres', () => {
    expect(() => categoriaInputSchema.parse({ ...inputValido, nome: 'a'.repeat(61) })).toThrow()
  })

  it('rejeita tipo fora do enum', () => {
    expect(() => categoriaInputSchema.parse({ ...inputValido, tipo: 'Outro' })).toThrow()
  })

  it('rejeita cor sem #', () => {
    expect(() => categoriaInputSchema.parse({ ...inputValido, cor: '4caf50' })).toThrow()
  })

  it('rejeita cor muito curta (#abc)', () => {
    expect(() => categoriaInputSchema.parse({ ...inputValido, cor: '#abc' })).toThrow()
  })

  it('rejeita cor com caracteres inválidos', () => {
    expect(() => categoriaInputSchema.parse({ ...inputValido, cor: '#ZZZZZZ' })).toThrow()
  })
})
