import { describe, expect, it } from 'vitest'
import { statusVariant } from '../status-variant'

describe('statusVariant', () => {
  it('mapeia Aberta para a variante open', () => {
    expect(statusVariant('Aberta')).toBe('open')
  })

  it('mapeia Fechada para a variante closed', () => {
    expect(statusVariant('Fechada')).toBe('closed')
  })

  it('mapeia Paga para a variante paid', () => {
    expect(statusVariant('Paga')).toBe('paid')
  })
})
