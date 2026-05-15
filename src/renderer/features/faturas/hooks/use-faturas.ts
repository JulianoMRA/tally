import { useState, useEffect, useCallback } from 'react'
import type { Fatura } from '@domain/entities/fatura'
import type { FaturaDetalhada } from '@shared/ipc/fatura'

export function useFaturasPorCartao(cartaoId: number | null) {
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (cartaoId === null) {
      setFaturas([])
      return
    }
    setLoading(true)
    const data = await window.api.fatura.listarPorCartao(cartaoId)
    setFaturas(data)
    setLoading(false)
  }, [cartaoId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { faturas, loading, refetch }
}

export function useFaturaDetalhe(faturaId: number | null) {
  const [detalhe, setDetalhe] = useState<FaturaDetalhada | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (faturaId === null) {
      setDetalhe(null)
      return
    }
    setLoading(true)
    window.api.fatura.detalharComParcelas(faturaId).then((data) => {
      setDetalhe(data)
      setLoading(false)
    })
  }, [faturaId])

  return { detalhe, loading }
}
