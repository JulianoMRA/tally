import { describe, it, expect } from 'vitest'
import { categoria } from '../../__tests__/__fixtures__/builders'
import { categoriasParaEdicao, ordenarParaFiltro, rotuloDeCategoria } from '../categorias'

describe('rotuloDeCategoria', () => {
  it('devolve só o nome da categoria ativa', () => {
    expect(rotuloDeCategoria(categoria({ nome: 'Lazer' }))).toBe('Lazer')
  })

  it('marca a arquivada, para ela não passar por uma escolha disponível', () => {
    expect(rotuloDeCategoria(categoria({ nome: 'Viagem', ativo: false }))).toBe(
      'Viagem (arquivada)'
    )
  })
})

describe('categoriasParaEdicao', () => {
  // Na ordem em que o repositório entrega: por nome, arquivadas misturadas.
  const antiga = categoria({ id: 1, nome: 'Antiga', ativo: false })
  const lazer = categoria({ id: 2, nome: 'Lazer' })
  const moradia = categoria({ id: 3, nome: 'Moradia' })
  const viagem = categoria({ id: 4, nome: 'Viagem', ativo: false })
  const todas = [antiga, lazer, moradia, viagem]

  it('oferece só as ativas quando a categoria atual é ativa', () => {
    expect(categoriasParaEdicao(todas, lazer.id)).toEqual([lazer, moradia])
  })

  // Sem a atual entre as opções, o select mostrava a primeira da lista como se
  // fosse a categoria da despesa — o valor salvo seguia certo, a tela não.
  it('inclui a categoria atual arquivada, depois das ativas', () => {
    expect(categoriasParaEdicao(todas, viagem.id)).toEqual([lazer, moradia, viagem])
  })

  it('não oferece as outras arquivadas', () => {
    expect(categoriasParaEdicao(todas, viagem.id)).not.toContain(antiga)
  })

  it('devolve só as ativas quando a atual não está na lista', () => {
    expect(categoriasParaEdicao(todas, 99)).toEqual([lazer, moradia])
  })
})

describe('ordenarParaFiltro', () => {
  it('põe as ativas em ordem alfabética e as arquivadas no fim (RF-CAT-02)', () => {
    const lista = [
      categoria({ nome: 'Viagem', ativo: false }),
      categoria({ nome: 'Lazer' }),
      categoria({ nome: 'Academia', ativo: false }),
      categoria({ nome: 'Água' })
    ]

    expect(ordenarParaFiltro(lista).map((c) => c.nome)).toEqual([
      'Água',
      'Lazer',
      'Academia',
      'Viagem'
    ])
  })

  it('não altera a lista recebida', () => {
    const lista = [categoria({ nome: 'Viagem', ativo: false }), categoria({ nome: 'Lazer' })]
    const antes = [...lista]

    ordenarParaFiltro(lista)

    expect(lista).toEqual(antes)
  })
})
