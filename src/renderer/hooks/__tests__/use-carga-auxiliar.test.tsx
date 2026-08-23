// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ToastProvider } from '../../components/ui'
import { useCargaAuxiliar } from '../use-carga-auxiliar'

function comToast({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}

describe('useCargaAuxiliar', () => {
  afterEach(cleanup)

  it('aplica os dados carregados uma única vez', async () => {
    const aplicar = vi.fn()
    const carregar = vi.fn().mockResolvedValue([{ id: 1 }])
    const { rerender } = renderHook(
      () => useCargaAuxiliar(carregar, aplicar, 'Erro ao carregar.'),
      { wrapper: comToast }
    )

    await waitFor(() => expect(aplicar).toHaveBeenCalledWith([{ id: 1 }]))

    rerender()
    rerender()
    expect(carregar).toHaveBeenCalledTimes(1)
  })

  // Estes carregamentos alimentam selects e rótulos. Sem `.catch` a rejeição
  // ficava solta e a lista permanecia vazia em silêncio: o select abria sem
  // opções e os nomes caíam no fallback `#id`, sem nada dizer que falhou.
  it('avisa por toast quando a carga falha, sem deixar a rejeição solta', async () => {
    const aplicar = vi.fn()
    const carregar = vi
      .fn()
      .mockImplementation(() =>
        Promise.reject(
          new Error("Error invoking remote method 'categoria:list': Error: Banco indisponível")
        )
      )
    const { result } = renderHook(
      () => useCargaAuxiliar(carregar, aplicar, 'Erro ao carregar categorias.'),
      { wrapper: comToast }
    )

    await waitFor(() => expect(result.current).toBeUndefined())
    expect(aplicar).not.toHaveBeenCalled()
    await waitFor(() => expect(document.body.textContent).toContain('Banco indisponível'))
    expect(document.body.textContent).not.toContain('Error invoking remote method')
  })

  it('cai no texto de apoio quando o erro não tem mensagem própria', async () => {
    const carregar = vi.fn().mockImplementation(() => Promise.reject('falha crua'))
    renderHook(() => useCargaAuxiliar(carregar, vi.fn(), 'Erro ao carregar categorias.'), {
      wrapper: comToast
    })

    await waitFor(() => expect(document.body.textContent).toContain('Erro ao carregar categorias.'))
  })

  it('não aplica dados depois que o componente desmonta', async () => {
    const aplicar = vi.fn()
    let liberar: (v: unknown[]) => void = () => {}
    const carregar = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          liberar = resolve
        })
    )
    const { unmount } = renderHook(() => useCargaAuxiliar(carregar, aplicar, 'Erro.'), {
      wrapper: comToast
    })

    unmount()
    liberar([{ id: 1 }])
    await Promise.resolve()

    expect(aplicar).not.toHaveBeenCalled()
  })
})
