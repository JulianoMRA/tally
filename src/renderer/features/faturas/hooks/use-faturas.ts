import { useState, useEffect, useCallback } from 'react'
import type { Cartao } from '@domain/entities/cartao'
import type { Fatura } from '@domain/entities/fatura'
import type { FaturaDetalhada } from '@shared/ipc/fatura'

export type GrupoFaturasCartao = { cartao: Cartao; faturas: Fatura[] }

export function useCicloFatura(onSucesso: (fatura: Fatura) => void) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function executar(acao: () => Promise<Fatura>) {
    setLoading(true)
    setErro(null)
    try {
      const fatura = await acao()
      onSucesso(fatura)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  function fechar(faturaId: number) {
    return executar(() => window.api.fatura.fechar(faturaId))
  }

  function pagar(faturaId: number, dataPagamento: string) {
    return executar(() => window.api.fatura.pagar(faturaId, dataPagamento))
  }

  function reabrir(faturaId: number) {
    return executar(() => window.api.fatura.reabrir(faturaId))
  }

  return { fechar, pagar, reabrir, loading, erro }
}

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

// Casa cada cartão com a sua lista de faturas pelo índice (alinhado ao
// Promise.all). Pura para permitir teste sem montar o hook.
export function agruparFaturasPorCartao(
  cartoes: Cartao[],
  listas: Fatura[][]
): GrupoFaturasCartao[] {
  return cartoes.map((cartao, i) => ({ cartao, faturas: listas[i] ?? [] }))
}

// Agrega as faturas de todos os cartões para a visão geral da landing.
// `cartoes` vem de useState (referência estável até carregar), então depender
// dele direto não causa refetch em loop. Cartões são poucos: Promise.all basta.
export function useFaturasDeTodosCartoes(cartoes: Cartao[]) {
  const [grupos, setGrupos] = useState<GrupoFaturasCartao[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (cartoes.length === 0) {
      setGrupos([])
      return
    }
    setLoading(true)
    const listas = await Promise.all(cartoes.map((c) => window.api.fatura.listarPorCartao(c.id)))
    setGrupos(agruparFaturasPorCartao(cartoes, listas))
    setLoading(false)
  }, [cartoes])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { grupos, loading, refetch }
}

export function useFaturaDetalhe(faturaId: number | null) {
  const [detalhe, setDetalhe] = useState<FaturaDetalhada | null>(null)
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (faturaId === null) {
      setDetalhe(null)
      return
    }
    setLoading(true)
    const data = await window.api.fatura.detalharComParcelas(faturaId)
    setDetalhe(data)
    setLoading(false)
  }, [faturaId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { detalhe, loading, refetch }
}
