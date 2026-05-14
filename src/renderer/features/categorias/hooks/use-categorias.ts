import { useState, useEffect, useCallback } from 'react'
import type { Categoria } from '@domain/entities/categoria'
import type { CategoriaInput } from '@shared/ipc/categoria'

type State = {
  categorias: Categoria[]
  loading: boolean
  error: string | null
}

export function useCategorias() {
  const [state, setState] = useState<State>({ categorias: [], loading: true, error: null })
  const [incluirArquivados, setIncluirArquivados] = useState(false)

  const refetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const categorias = await window.api.categoria.list({ incluirArquivados })
      setState({ categorias, loading: false, error: null })
    } catch (err) {
      setState({ categorias: [], loading: false, error: String(err) })
    }
  }, [incluirArquivados])

  useEffect(() => {
    refetch()
  }, [refetch])

  const criar = useCallback(
    async (input: CategoriaInput) => {
      await window.api.categoria.create(input)
      await refetch()
    },
    [refetch]
  )

  const atualizar = useCallback(
    async (id: number, input: CategoriaInput) => {
      await window.api.categoria.update(id, input)
      await refetch()
    },
    [refetch]
  )

  const arquivar = useCallback(
    async (id: number) => {
      await window.api.categoria.arquivar(id)
      await refetch()
    },
    [refetch]
  )

  const desarquivar = useCallback(
    async (id: number) => {
      await window.api.categoria.desarquivar(id)
      await refetch()
    },
    [refetch]
  )

  return {
    categorias: state.categorias,
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
