import { useCallback, useEffect, useState } from 'react'
import type { DespesaComTags } from '@shared/ipc/despesa'

// Carrega todas as despesas-mestre (1 linha por despesa) com suas tags. O
// filtro por tipo/busca é aplicado no componente para alternar a visão sem
// novo round-trip de IPC.
export function useSaidas() {
  const [despesas, setDespesas] = useState<DespesaComTags[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await window.api.despesa.listarComTags()
      setDespesas(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar saídas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { despesas, loading, erro, recarregar }
}
