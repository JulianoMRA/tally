import { useCallback, useEffect, useState } from 'react'
import type { PontoEvolucaoSaldo } from '@shared/ipc/relatorio'

export function useEvolucaoSaldo(mesFinal: string, meses: 6 | 12) {
  const [dados, setDados] = useState<PontoEvolucaoSaldo[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await window.api.relatorio.evolucaoSaldo({ mesFinal, meses })
      setDados(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar evolução.')
    } finally {
      setLoading(false)
    }
  }, [mesFinal, meses])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { dados, loading, erro, recarregar }
}
