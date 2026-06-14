import { useCallback, useEffect, useState } from 'react'
import type { Despesa } from '@domain/entities/despesa'

// Carrega todas as despesas-mestre (1 linha por despesa). O filtro por tipo
// é aplicado no componente para alternar a visão sem novo round-trip de IPC.
export function useSaidas() {
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await window.api.despesa.listarDespesas()
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
