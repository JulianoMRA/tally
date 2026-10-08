import { describe, expect, it } from 'vitest'
import { indiceDaTecla } from '../navegacao-por-setas'

describe('indiceDaTecla', () => {
  it('seta para a direita ou para baixo vai para o próximo', () => {
    expect(indiceDaTecla('ArrowRight', 1, 4)).toBe(2)
    expect(indiceDaTecla('ArrowDown', 1, 4)).toBe(2)
  })

  it('seta para a esquerda ou para cima vai para o anterior', () => {
    expect(indiceDaTecla('ArrowLeft', 2, 4)).toBe(1)
    expect(indiceDaTecla('ArrowUp', 2, 4)).toBe(1)
  })

  it('as setas dão a volta nas pontas', () => {
    expect(indiceDaTecla('ArrowRight', 3, 4)).toBe(0)
    expect(indiceDaTecla('ArrowLeft', 0, 4)).toBe(3)
  })

  it('Home e End vão às pontas', () => {
    expect(indiceDaTecla('Home', 2, 4)).toBe(0)
    expect(indiceDaTecla('End', 1, 4)).toBe(3)
  })

  it('tecla que não navega devolve null', () => {
    expect(indiceDaTecla('Enter', 1, 4)).toBeNull()
    expect(indiceDaTecla('a', 1, 4)).toBeNull()
  })

  it('grupo vazio devolve null', () => {
    expect(indiceDaTecla('ArrowRight', 0, 0)).toBeNull()
  })
})
