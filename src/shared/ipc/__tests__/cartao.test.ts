import { describe, it, expect } from 'vitest'
import { cartaoInputSchema } from '../cartao'

describe('cartaoInputSchema', () => {
  const inputValido = {
    nome: 'Inter',
    diaFechamento: 5,
    diaVencimento: 12,
    cor: '#ff7a00'
  }

  it('aceita input válido', () => {
    expect(() => cartaoInputSchema.parse(inputValido)).not.toThrow()
  })

  it('aceita cores minúsculas e maiúsculas', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, cor: '#a0b1c2' })).not.toThrow()
    expect(() => cartaoInputSchema.parse({ ...inputValido, cor: '#AABBCC' })).not.toThrow()
  })

  it('aceita dias nos extremos (1 e 31)', () => {
    expect(() =>
      cartaoInputSchema.parse({ ...inputValido, diaFechamento: 1, diaVencimento: 31 })
    ).not.toThrow()
  })

  it('rejeita nome vazio', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, nome: '' })).toThrow()
  })

  it('rejeita nome apenas com espaços (trim reduz para vazio)', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, nome: '   ' })).toThrow()
  })

  it('rejeita nome com mais de 60 caracteres', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, nome: 'a'.repeat(61) })).toThrow()
  })

  it('rejeita diaFechamento = 0', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, diaFechamento: 0 })).toThrow()
  })

  it('rejeita diaFechamento = 32', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, diaFechamento: 32 })).toThrow()
  })

  it('rejeita diaFechamento decimal', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, diaFechamento: 1.5 })).toThrow()
  })

  it('rejeita diaFechamento NaN', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, diaFechamento: Number.NaN })).toThrow()
  })

  it('rejeita diaFechamento string', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, diaFechamento: '5' })).toThrow()
  })

  it('rejeita diaVencimento = 0', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, diaVencimento: 0 })).toThrow()
  })

  it('rejeita diaVencimento = 32', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, diaVencimento: 32 })).toThrow()
  })

  it('rejeita diaVencimento decimal', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, diaVencimento: 1.5 })).toThrow()
  })

  it('rejeita diaVencimento string', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, diaVencimento: '12' })).toThrow()
  })

  it('rejeita cor sem #', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, cor: 'ff7a00' })).toThrow()
  })

  it('rejeita cor muito curta (#abc)', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, cor: '#abc' })).toThrow()
  })

  it('rejeita cor muito longa (#abcdefg)', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, cor: '#abcdefg' })).toThrow()
  })

  it('rejeita cor com caracteres inválidos (#ZZZZZZ)', () => {
    expect(() => cartaoInputSchema.parse({ ...inputValido, cor: '#ZZZZZZ' })).toThrow()
  })
})
