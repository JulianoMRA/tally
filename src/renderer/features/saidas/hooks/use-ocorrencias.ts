import { useCallback, useEffect, useState } from 'react'
import type { OcorrenciaDoMes } from '@shared/ipc/despesa'

/**
 * Ocorrências de um mês: uma linha por parcela, não por despesa (RF-DES-14).
 *
 * Substitui `useSaidas`, que carregava todas as despesas já cadastradas de uma
 * vez. Aqui o recorte é do servidor, então trocar de mês é um round-trip novo —
 * os filtros de tipo, tag e busca seguem no componente, sobre o mês carregado.
 */
export function useOcorrencias(mesReferencia: string) {
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaDoMes[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await window.api.despesa.listarOcorrenciasDoMes({ mesReferencia })
      setOcorrencias(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar saídas.')
    } finally {
      setLoading(false)
    }
  }, [mesReferencia])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { ocorrencias, loading, erro, recarregar }
}
