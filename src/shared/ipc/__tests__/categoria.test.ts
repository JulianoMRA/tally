import { describe, it, expect } from 'vitest'
import { categoriaInputSchema } from '../categoria'

describe('categoriaInputSchema', () => {
  const inputValido = {
    nome: 'Mercado',
    tipo: 'Despesa' as const,
    cor: '#4caf50',
    icone: '🛒'
  }

  it('aceita input válido completo', () => {
    expect(() => categoriaInputSchema.parse(inputValido)).not.toThrow()
  })

  it('aceita input sem icone (undefined)', () => {
    const result = categoriaInputSchema.parse({ nome: 'Mercado', tipo: 'Despesa', cor: '#4caf50' })
    expect(result.icone).toBeNull()
  })

  it('aceita icone null explícito', () => {
    const result = categoriaInputSchema.parse({ ...inputValido, icone: null })
    expect(result.icone).toBeNull()
  })

  it('transforma string vazia de icone em null', () => {
    const result = categoriaInputSchema.parse({ ...inputValido, icone: '' })
    expect(result.icone).toBeNull()
  })

  it('transforma icone com só espaços em null', () => {
    const result = categoriaInputSchema.parse({ ...inputValido, icone: '   ' })
    expect(result.icone).toBeNull()
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

  it('rejeita icone com mais de 16 caracteres', () => {
    expect(() => categoriaInputSchema.parse({ ...inputValido, icone: 'a'.repeat(17) })).toThrow()
  })
})
