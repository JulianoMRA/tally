// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'
import { useCartoesAtivos } from '../use-cartoes-ativos'

function instalarApi(list: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('window', Object.assign(window, { api: { cartao: { list } } }))
}

describe('useCartoesAtivos', () => {
  afterEach(cleanup)

  it('expõe os cartões ativos e encerra o carregamento', async () => {
    instalarApi(vi.fn().mockResolvedValue([{ id: 1 }]))
    const { result } = renderHook(() => useCartoesAtivos())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.cartoes).toEqual([{ id: 1 }])
  })

  // O hook só tinha caminho de sucesso: um `.then` sem `.catch`. Numa falha do
  // IPC a rejeição ficava sem tratamento e `loading` nunca virava false — a tela
  // parava em "Carregando…" para sempre, sem dizer o que houve.
  it('encerra o carregamento e não deixa a rejeição solta quando o IPC falha', async () => {
    instalarApi(vi.fn().mockImplementation(() => Promise.reject(new Error('Banco indisponível'))))
    const { result } = renderHook(() => useCartoesAtivos())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.cartoes).toEqual([])
  })
})
