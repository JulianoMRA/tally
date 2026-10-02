// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, cleanup, act } from '@testing-library/react'
import type { Cartao } from '@domain/entities/cartao'
import {
  useCartoesDaTela,
  useCicloFatura,
  useFaturaDetalhe,
  useFaturasDeTodosCartoes
} from '../use-faturas'

function cartao(id: number, nome: string): Cartao {
  return {
    id,
    nome,
    diaFechamento: 5,
    diaVencimento: 12,
    cor: '#abc',
    ativo: true,
    createdAt: '',
    updatedAt: ''
  }
}

function instalarApi(fatura: Record<string, unknown>, cartao: Record<string, unknown> = {}) {
  vi.stubGlobal('window', Object.assign(window, { api: { fatura, cartao } }))
}

// Referência estável: o hook depende de `cartoes` direto no useCallback, e a
// página o alimenta a partir de useState. Recriar o array a cada render faria
// o efeito re-disparar em loop — contrato documentado no próprio hook.
const CARTOES = [cartao(1, 'Inter')]

const rejeitando = (mensagem: string) =>
  vi.fn().mockImplementation(() => Promise.reject(new Error(mensagem)))

/**
 * As duas cargas da tela de Faturas tinham só o caminho de sucesso: `setLoading(true)`,
 * `await`, `setLoading(false)`, sem `try/catch/finally`. Numa rejeição do IPC o
 * `setLoading(false)` nunca rodava e `FaturasPage` ficava presa em "Carregando…"
 * para sempre, sem dizer o que houve.
 *
 * É o mesmo defeito que a v1.6.2 corrigiu em sete cargas auxiliares e que
 * `use-cartoes-ativos` documenta no próprio comentário — hook usado nesta mesma
 * página, lado a lado com estes dois.
 */
describe('useFaturasDeTodosCartoes', () => {
  afterEach(cleanup)

  it('expõe os grupos e encerra o carregamento', async () => {
    instalarApi({ listarResumoPorCartao: vi.fn().mockResolvedValue([]) })
    const { result } = renderHook(() => useFaturasDeTodosCartoes(CARTOES))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.grupos).toEqual([{ cartao: CARTOES[0], faturas: [] }])
    expect(result.current.erro).toBeNull()
  })

  it('encerra o carregamento e informa o erro quando o IPC falha', async () => {
    instalarApi({ listarResumoPorCartao: rejeitando('Banco indisponível') })
    const { result } = renderHook(() => useFaturasDeTodosCartoes(CARTOES))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.erro).toMatch(/Banco indisponível/)
    expect(result.current.grupos).toEqual([])
  })

  it('limpa o erro anterior numa recarga bem-sucedida', async () => {
    const listarResumoPorCartao = rejeitando('Banco indisponível')
    instalarApi({ listarResumoPorCartao })
    const { result } = renderHook(() => useFaturasDeTodosCartoes(CARTOES))
    await waitFor(() => expect(result.current.erro).toMatch(/Banco indisponível/))

    listarResumoPorCartao.mockResolvedValue([])
    await result.current.refetch()

    await waitFor(() => expect(result.current.erro).toBeNull())
  })
})

describe('useFaturaDetalhe', () => {
  afterEach(cleanup)

  it('expõe o detalhe e encerra o carregamento', async () => {
    instalarApi({ detalharComParcelas: vi.fn().mockResolvedValue({ parcelas: [] }) })
    const { result } = renderHook(() => useFaturaDetalhe(7))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.detalhe).toEqual({ parcelas: [] })
    expect(result.current.erro).toBeNull()
  })

  it('encerra o carregamento e informa o erro quando o IPC falha', async () => {
    instalarApi({ detalharComParcelas: rejeitando('Fatura sumiu') })
    const { result } = renderHook(() => useFaturaDetalhe(7))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.erro).toMatch(/Fatura sumiu/)
    expect(result.current.detalhe).toBeNull()
  })

  // Sem fatura em foco não há carga: o estado precisa voltar ao neutro, e não
  // guardar o erro da fatura anterior.
  it('zera detalhe e erro quando não há fatura em foco', async () => {
    instalarApi({ detalharComParcelas: rejeitando('Fatura sumiu') })
    const { result, rerender } = renderHook(({ id }) => useFaturaDetalhe(id), {
      initialProps: { id: 7 as number | null }
    })
    await waitFor(() => expect(result.current.erro).toMatch(/Fatura sumiu/))

    rerender({ id: null })

    await waitFor(() => expect(result.current.erro).toBeNull())
    expect(result.current.detalhe).toBeNull()
  })

  /**
   * O painel passou a ficar montado enquanto a fatura seguinte carrega, com o
   * conteúdo anterior na tela. Antes ele renascia a cada troca, e uma resposta
   * que chegasse tarde caía num componente que já não existia. Agora ela
   * cobriria a fatura mais nova — por isso só a resposta do último pedido vale.
   */
  describe('resposta atrasada', () => {
    // Dublê lento de propósito: setembro só responde quando o teste manda.
    function instalarComSetembroLento() {
      let entregarSetembro: (detalhe: unknown) => void = () => {}
      const detalharComParcelas = vi.fn((id: number) =>
        id === 9
          ? new Promise((resolve) => {
              entregarSetembro = resolve
            })
          : Promise.resolve({ fatura: { id }, parcelas: [] })
      )
      instalarApi({ detalharComParcelas })
      return { entregarSetembro: (detalhe: unknown) => entregarSetembro(detalhe) }
    }

    it('a de uma fatura anterior não cobre a mais nova', async () => {
      const { entregarSetembro } = instalarComSetembroLento()
      const { result, rerender } = renderHook(({ id }) => useFaturaDetalhe(id), {
        initialProps: { id: 9 as number | null }
      })

      rerender({ id: 11 })
      await waitFor(() =>
        expect(result.current.detalhe).toEqual({ fatura: { id: 11 }, parcelas: [] })
      )
      await act(async () => {
        entregarSetembro({ fatura: { id: 9 }, parcelas: [] })
      })

      expect(result.current.detalhe).toEqual({ fatura: { id: 11 }, parcelas: [] })
      expect(result.current.loading).toBe(false)
    })

    it('sem fatura em foco, a que estava a caminho é descartada', async () => {
      const { entregarSetembro } = instalarComSetembroLento()
      const { result, rerender } = renderHook(({ id }) => useFaturaDetalhe(id), {
        initialProps: { id: 9 as number | null }
      })

      rerender({ id: null })
      await waitFor(() => expect(result.current.loading).toBe(false))
      await act(async () => {
        entregarSetembro({ fatura: { id: 9 }, parcelas: [] })
      })

      expect(result.current.detalhe).toBeNull()
      expect(result.current.loading).toBe(false)
    })
  })
})

/**
 * Faturas carregava só os cartões ativos (RF-CAR-02). O arquivado com fatura a
 * pagar precisa chegar à tela, e quem decide se ele entra no trilho é
 * `cartoesDoTrilho` — por isso a carga pede todos.
 */
describe('useCartoesDaTela', () => {
  afterEach(cleanup)

  it('pede os cartões com os arquivados e encerra o carregamento', async () => {
    const list = vi.fn().mockResolvedValue(CARTOES)
    instalarApi({}, { list })
    const { result } = renderHook(() => useCartoesDaTela())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(list).toHaveBeenCalledWith({ incluirArquivados: true })
    expect(result.current.cartoes).toEqual(CARTOES)
    expect(result.current.erro).toBeNull()
  })

  it('encerra o carregamento e informa o erro quando o IPC falha', async () => {
    instalarApi({}, { list: rejeitando('Banco indisponível') })
    const { result } = renderHook(() => useCartoesDaTela())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.erro).toMatch(/Banco indisponível/)
    expect(result.current.cartoes).toEqual([])
  })
})

/**
 * O ciclo da fatura mostrava `e.message` cru: o erro do main chega embrulhado
 * pelo Electron ("Error invoking remote method…"), e com data vazia o card
 * mostrava o JSON do zod. E o diálogo de pagamento precisa saber se pagar deu
 * certo para fechar só nesse caso.
 */
describe('useCicloFatura', () => {
  afterEach(cleanup)

  it('pagar com sucesso avisa quem chamou e devolve true', async () => {
    const paga = { id: 7, status: { kind: 'Paga', pagaEm: '2026-09-29' } }
    instalarApi({ pagar: vi.fn().mockResolvedValue(paga) })
    const onSucesso = vi.fn()
    const { result } = renderHook(() => useCicloFatura(onSucesso))

    let ok = false
    await act(async () => {
      ok = await result.current.pagar(7, '2026-09-29')
    })

    expect(ok).toBe(true)
    expect(onSucesso).toHaveBeenCalledWith(paga)
    expect(result.current.erroDa(7)).toBeNull()
  })

  it('a falha devolve false e a mensagem sem o prefixo do Electron', async () => {
    instalarApi({
      pagar: rejeitando("Error invoking remote method 'fatura:pagar': Error: Fatura já está paga.")
    })
    const { result } = renderHook(() => useCicloFatura(vi.fn()))

    let ok = true
    await act(async () => {
      ok = await result.current.pagar(7, '2026-09-29')
    })

    expect(ok).toBe(false)
    expect(result.current.erroDa(7)).toBe('Fatura já está paga.')
  })

  // O painel fica montado ao trocar de fatura, e o hook vive nele: o erro
  // precisa saber de qual fatura é, senão acompanha a navegação.
  it('o erro pertence à fatura em que a ação falhou', async () => {
    instalarApi({ pagar: rejeitando('Banco indisponível') })
    const { result } = renderHook(() => useCicloFatura(vi.fn()))

    await act(async () => {
      await result.current.pagar(7, '2026-09-29')
    })

    expect(result.current.erroDa(7)).toBe('Banco indisponível')
    expect(result.current.erroDa(8)).toBeNull()
  })
})
