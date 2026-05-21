import { useCallback, useEffect, useState } from 'react'
import type { PontoEvolucaoCategoria } from '@shared/ipc/relatorio'

export function useEvolucaoCategoria(categoriaId: number | null, mesFinal: string, meses: 6 | 12) {
  const [dados, setDados] = useState<PontoEvolucaoCategoria[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    if (categoriaId === null) {
      setDados([])
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const data = await window.api.relatorio.evolucaoCategoria({ categoriaId, mesFinal, meses })
      setDados(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar evolução da categoria.')
    } finally {
      setLoading(false)
    }
  }, [categoriaId, mesFinal, meses])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { dados, loading, erro, recarregar }
}
