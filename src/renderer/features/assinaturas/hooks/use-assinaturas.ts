import { useCallback, useEffect, useState } from 'react'
import type { Despesa } from '@domain/entities/despesa'

export function useAssinaturas() {
  const [assinaturas, setAssinaturas] = useState<Despesa[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await window.api.despesa.listarAssinaturas()
      setAssinaturas(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar assinaturas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { assinaturas, loading, erro, recarregar }
}
