// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act, cleanup } from '@testing-library/react'
import { useListaArquivavel } from '../use-lista-arquivavel'

describe('useListaArquivavel', () => {
  afterEach(cleanup)

  it('carrega a lista na montagem, começando em loading', async () => {
    const carregar = vi.fn().mockResolvedValue([{ id: 1 }])
    const { result } = renderHook(() => useListaArquivavel(carregar, 'Erro ao listar.'))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.itens).toEqual([{ id: 1 }])
    expect(result.current.error).toBeNull()
    expect(carregar).toHaveBeenCalledWith(false)
  })

  it('recarrega repassando o novo valor quando o filtro de arquivados muda', async () => {
    const carregar = vi.fn().mockResolvedValue([])
    const { result } = renderHook(() => useListaArquivavel(carregar, 'Erro ao listar.'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setIncluirArquivados(true))
    await waitFor(() => expect(carregar).toHaveBeenLastCalledWith(true))
  })

  // O ponto da correção: `String(err)` entregava à tela o texto embrulhado pelo
  // Electron — "Error: Error invoking remote method 'cartao:list': Error: X" —,
  // enquanto as mutações das mesmas telas já passavam por `mensagemErro`.
  it('descasca o prefixo do IPC na mensagem de erro', async () => {
    const carregar = vi
      .fn()
      .mockRejectedValue(
        new Error("Error invoking remote method 'cartao:list': Error: Banco indisponível")
      )
    const { result } = renderHook(() => useListaArquivavel(carregar, 'Erro ao listar.'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Banco indisponível')
    expect(result.current.itens).toEqual([])
  })

  it('cai no texto de apoio quando o erro não tem mensagem própria', async () => {
    const carregar = vi.fn().mockRejectedValue('falha crua')
    const { result } = renderHook(() => useListaArquivavel(carregar, 'Erro ao listar cartões.'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Erro ao listar cartões.')
  })

  // Sem isto o hook é uma armadilha: quem passar um arrow inline — o jeito
  // natural de chamar — recria `carregar` a cada render, o que mudaria
  // `refetch` e faria o efeito recarregar para sempre.
  it('não recarrega em laço quando recebe um callback recriado a cada render', async () => {
    const carregar = vi.fn().mockResolvedValue([])
    const { result, rerender } = renderHook(() =>
      useListaArquivavel((incluir) => carregar(incluir), 'Erro ao listar.')
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    rerender()
    rerender()
    rerender()

    expect(carregar).toHaveBeenCalledTimes(1)
  })

  it('limpa o erro anterior ao recarregar com sucesso', async () => {
    const carregar = vi
      .fn()
      .mockRejectedValueOnce(new Error('Banco indisponível'))
      .mockResolvedValue([{ id: 7 }])
    const { result } = renderHook(() => useListaArquivavel(carregar, 'Erro ao listar.'))
    await waitFor(() => expect(result.current.error).toBe('Banco indisponível'))

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.itens).toEqual([{ id: 7 }])
  })
})
