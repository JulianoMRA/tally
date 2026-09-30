import { useState, useEffect, useCallback } from 'react'
import type { Cartao } from '@domain/entities/cartao'
import type { Fatura } from '@domain/entities/fatura'
import type { FaturaComTotal, FaturaDetalhada } from '@shared/ipc/fatura'
import { mensagemErro } from '../../../lib/mensagem-erro'

export type GrupoFaturasCartao = { cartao: Cartao; faturas: FaturaComTotal[] }

export function useCicloFatura(onSucesso: (fatura: Fatura) => void) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Devolve se deu certo: o diálogo de pagamento só fecha nesse caso, e o erro
  // fica nele. `mensagemErro` tira o prefixo com que o Electron embrulha o erro
  // do main — sem isso o resumo mostrava "Error invoking remote method…".
  async function executar(acao: () => Promise<Fatura>): Promise<boolean> {
    setLoading(true)
    setErro(null)
    try {
      const fatura = await acao()
      onSucesso(fatura)
      return true
    } catch (e) {
      setErro(mensagemErro(e, 'Erro ao atualizar a fatura.'))
      return false
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

/**
 * Cartões da tela de Faturas, arquivados inclusive (RF-CAR-02). Quem decide se
 * o arquivado entra no trilho é `cartoesDoTrilho`, olhando as faturas dele —
 * antes a tela carregava só os ativos, e a fatura de um cartão arquivado ficava
 * sem ter onde ser paga.
 */
export function useCartoesDaTela() {
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    window.api.cartao
      .list({ incluirArquivados: true })
      .then((data) => {
        if (ativo) setCartoes(data)
      })
      .catch((e: unknown) => {
        if (ativo) setErro(mensagemErro(e, 'Erro ao listar cartões.'))
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  return { cartoes, loading, erro }
}

// Casa cada cartão com a sua lista de faturas pelo índice (alinhado ao
// Promise.all). Pura para permitir teste sem montar o hook.
export function agruparFaturasPorCartao(
  cartoes: Cartao[],
  listas: FaturaComTotal[][]
): GrupoFaturasCartao[] {
  return cartoes.map((cartao, i) => ({ cartao, faturas: listas[i] ?? [] }))
}

// Agrega as faturas de todos os cartões para a visão geral da landing.
// `cartoes` vem de useState (referência estável até carregar), então depender
// dele direto não causa refetch em loop. Cartões são poucos: Promise.all basta.
export function useFaturasDeTodosCartoes(cartoes: Cartao[]) {
  const [grupos, setGrupos] = useState<GrupoFaturasCartao[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (cartoes.length === 0) {
      setGrupos([])
      setErro(null)
      return
    }
    setLoading(true)
    setErro(null)
    try {
      // listarResumoPorCartao e nao listarPorCartao: a lista precisa do total de
      // cada fatura, e obter isso por detalharComParcelas seria um N+1.
      const listas = await Promise.all(
        cartoes.map((c) => window.api.fatura.listarResumoPorCartao(c.id))
      )
      setGrupos(agruparFaturasPorCartao(cartoes, listas))
    } catch (e) {
      setErro(mensagemErro(e, 'Erro ao carregar as faturas.'))
      setGrupos([])
    } finally {
      setLoading(false)
    }
  }, [cartoes])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { grupos, loading, erro, refetch }
}

export function useFaturaDetalhe(faturaId: number | null) {
  const [detalhe, setDetalhe] = useState<FaturaDetalhada | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (faturaId === null) {
      setDetalhe(null)
      setErro(null)
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const data = await window.api.fatura.detalharComParcelas(faturaId)
      setDetalhe(data)
    } catch (e) {
      setErro(mensagemErro(e, 'Erro ao carregar a fatura.'))
      setDetalhe(null)
    } finally {
      setLoading(false)
    }
  }, [faturaId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { detalhe, loading, erro, refetch }
}
