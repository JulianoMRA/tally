import { useState, useEffect, useCallback } from 'react'
import type { Contribuidor } from '@domain/entities/contribuidor'
import type { ContribuidorInput } from '@shared/ipc/contribuidor'

type State = {
  contribuidores: Contribuidor[]
  loading: boolean
  error: string | null
}

export function useContribuidores() {
  const [state, setState] = useState<State>({ contribuidores: [], loading: true, error: null })
  const [incluirArquivados, setIncluirArquivados] = useState(false)

  const refetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const contribuidores = await window.api.contribuidor.list({ incluirArquivados })
      setState({ contribuidores, loading: false, error: null })
    } catch (err) {
      setState({ contribuidores: [], loading: false, error: String(err) })
    }
  }, [incluirArquivados])

  useEffect(() => {
    refetch()
  }, [refetch])

  const criar = useCallback(
    async (input: ContribuidorInput) => {
      await window.api.contribuidor.create(input)
      await refetch()
    },
    [refetch]
  )

  const atualizar = useCallback(
    async (id: number, input: ContribuidorInput) => {
      await window.api.contribuidor.update(id, input)
      await refetch()
    },
    [refetch]
  )

  const arquivar = useCallback(
    async (id: number) => {
      await window.api.contribuidor.arquivar(id)
      await refetch()
    },
    [refetch]
  )

  const desarquivar = useCallback(
    async (id: number) => {
      await window.api.contribuidor.desarquivar(id)
      await refetch()
    },
    [refetch]
  )

  return {
    contribuidores: state.contribuidores,
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
