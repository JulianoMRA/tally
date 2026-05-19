import { useCallback, useEffect, useState } from 'react'
import type { StatusAjuda } from '@domain/entities/ajuda'
import type { AjudaAgrupada } from '@shared/ipc/ajuda'

export function useAjudasAgrupadas(status?: StatusAjuda) {
  const [grupos, setGrupos] = useState<AjudaAgrupada[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await window.api.ajuda.listarAgrupadoPorContribuidor(
        status ? { status } : undefined
      )
      setGrupos(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar ajudas.')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { grupos, loading, erro, recarregar }
}
