import { useCallback, useEffect, useState } from 'react'
import type { TotalPorCategoria } from '@shared/ipc/relatorio'

export function useTotaisCategoria(mesReferencia: string) {
  const [totais, setTotais] = useState<TotalPorCategoria[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await window.api.relatorio.totaisPorCategoria({ mesReferencia })
      setTotais(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar totais.')
    } finally {
      setLoading(false)
    }
  }, [mesReferencia])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { totais, loading, erro, recarregar }
}
