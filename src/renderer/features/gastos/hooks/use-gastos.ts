import { useCallback, useEffect, useState } from 'react'
import type { Despesa } from '@domain/entities/despesa'

export function useGastosForaCartao(mesReferencia: string) {
  const [gastos, setGastos] = useState<Despesa[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await window.api.despesa.listarGastosForaCartao({ mesReferencia })
      setGastos(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar gastos.')
    } finally {
      setLoading(false)
    }
  }, [mesReferencia])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { gastos, loading, erro, recarregar }
}
