import { useState, useEffect, useCallback } from 'react'
import type { Cartao } from '@domain/entities/cartao'
import type { CartaoInput } from '@shared/ipc/cartao'

type State = {
  cartoes: Cartao[]
  loading: boolean
  error: string | null
}

export function useCartoes() {
  const [state, setState] = useState<State>({ cartoes: [], loading: true, error: null })
  const [incluirArquivados, setIncluirArquivados] = useState(false)

  const refetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const cartoes = await window.api.cartao.list({ incluirArquivados })
      setState({ cartoes, loading: false, error: null })
    } catch (err) {
      setState({ cartoes: [], loading: false, error: String(err) })
    }
  }, [incluirArquivados])

  useEffect(() => {
    refetch()
  }, [refetch])

  const criar = useCallback(
    async (input: CartaoInput) => {
      await window.api.cartao.create(input)
      await refetch()
    },
    [refetch]
  )

  const atualizar = useCallback(
    async (id: number, input: CartaoInput) => {
      await window.api.cartao.update(id, input)
      await refetch()
    },
    [refetch]
  )

  const arquivar = useCallback(
    async (id: number) => {
      await window.api.cartao.arquivar(id)
      await refetch()
    },
    [refetch]
  )

  const desarquivar = useCallback(
    async (id: number) => {
      await window.api.cartao.desarquivar(id)
      await refetch()
    },
    [refetch]
  )

  return {
    cartoes: state.cartoes,
    loading: state.loading,
    error: state.error,
    incluirArquivados,
    setIncluirArquivados,
    criar,
    atualizar,
    arquivar,
    desarquivar
  }
}
