import { useCallback, useEffect, useState } from 'react'
import type { Renda } from '@domain/entities/renda'

type State = {
  rendas: Renda[]
  loading: boolean
  error: string | null
}

export function useRendas() {
  const [state, setState] = useState<State>({ rendas: [], loading: true, error: null })
  const [incluirArquivadas, setIncluirArquivadas] = useState(false)

  const refetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const rendas = await window.api.renda.list({ incluirArquivadas })
      setState({ rendas, loading: false, error: null })
    } catch (err) {
      setState({ rendas: [], loading: false, error: String(err) })
    }
  }, [incluirArquivadas])

  useEffect(() => {
    refetch()
  }, [refetch])

  return {
    rendas: state.rendas,
    loading: state.loading,
    error: state.error,
    incluirArquivadas,
    setIncluirArquivadas,
    refetch
  }
}
