import { describe, it, expect } from 'vitest'
import { filtrarPorDescricao } from '../filtrar-saidas'

const itens = [
  { descricao: 'Café da manhã' },
  { descricao: 'Almoço no centro' },
  { descricao: 'CAFETERIA premium' },
  { descricao: 'Uber' }
]

describe('filtrarPorDescricao', () => {
  it('busca vazia ou só espaços devolve tudo (cópia)', () => {
    expect(filtrarPorDescricao(itens, '')).toHaveLength(4)
    expect(filtrarPorDescricao(itens, '   ')).toHaveLength(4)
  })

  it('ignora acentos nos dois sentidos', () => {
    expect(filtrarPorDescricao(itens, 'cafe').map((i) => i.descricao)).toEqual([
      'Café da manhã',
      'CAFETERIA premium'
    ])
    expect(filtrarPorDescricao(itens, 'almoco').map((i) => i.descricao)).toEqual([
      'Almoço no centro'
    ])
  })

  it('ignora caixa', () => {
    expect(filtrarPorDescricao(itens, 'UBER').map((i) => i.descricao)).toEqual(['Uber'])
  })

  it('casa por trecho (substring)', () => {
    expect(filtrarPorDescricao(itens, 'centro')).toHaveLength(1)
  })

  it('sem correspondência devolve vazio', () => {
    expect(filtrarPorDescricao(itens, 'xyz')).toEqual([])
  })
})
