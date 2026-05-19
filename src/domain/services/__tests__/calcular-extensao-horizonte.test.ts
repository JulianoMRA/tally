import { describe, expect, it } from 'vitest'
import { calcularExtensaoNecessaria } from '../calcular-extensao-horizonte'

describe('calcularExtensaoNecessaria', () => {
  it('retorna null quando o mes alvo ja esta coberto (igual ao ultimo existente)', () => {
    const r = calcularExtensaoNecessaria({
      mesAlvo: '2026-12',
      ultimoMesExistente: '2026-12',
      ultimoNumeroExistente: 12
    })
    expect(r).toBeNull()
  })

  it('retorna null quando o mes alvo e anterior ao ultimo existente (nao retroage)', () => {
    const r = calcularExtensaoNecessaria({
      mesAlvo: '2026-08',
      ultimoMesExistente: '2026-12',
      ultimoNumeroExistente: 12
    })
    expect(r).toBeNull()
  })

  it('estende em 1 mes quando alvo e exatamente o seguinte ao ultimo existente', () => {
    const r = calcularExtensaoNecessaria({
      mesAlvo: '2027-01',
      ultimoMesExistente: '2026-12',
      ultimoNumeroExistente: 12
    })
    expect(r).toEqual({
      quantidade: 1,
      ocorrenciaInicial: 13,
      mesReferenciaInicial: '2027-01'
    })
  })

  it('estende em N meses quando alvo esta varios meses adiante', () => {
    const r = calcularExtensaoNecessaria({
      mesAlvo: '2027-06',
      ultimoMesExistente: '2026-12',
      ultimoNumeroExistente: 12
    })
    expect(r).toEqual({
      quantidade: 6,
      ocorrenciaInicial: 13,
      mesReferenciaInicial: '2027-01'
    })
  })

  it('atravessa virada de ano nas duas pontas', () => {
    const r = calcularExtensaoNecessaria({
      mesAlvo: '2028-02',
      ultimoMesExistente: '2027-11',
      ultimoNumeroExistente: 23
    })
    expect(r).toEqual({
      quantidade: 3,
      ocorrenciaInicial: 24,
      mesReferenciaInicial: '2027-12'
    })
  })

  it('retorna null defensivamente quando ultimoMesExistente e null', () => {
    const r = calcularExtensaoNecessaria({
      mesAlvo: '2027-01',
      ultimoMesExistente: null,
      ultimoNumeroExistente: null
    })
    expect(r).toBeNull()
  })

  it('lanca erro se ultimoNumeroExistente vier nulo com ultimoMesExistente preenchido', () => {
    expect(() =>
      calcularExtensaoNecessaria({
        mesAlvo: '2027-01',
        ultimoMesExistente: '2026-12',
        ultimoNumeroExistente: null
      })
    ).toThrow()
  })
})
