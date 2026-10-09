import { useState, useEffect, useCallback, useRef } from 'react'
import type { Cartao } from '@domain/entities/cartao'
import type { Fatura } from '@domain/entities/fatura'
import type { FaturaComTotal, FaturaDetalhada } from '@shared/ipc/fatura'
import { mensagemErro } from '../../../lib/mensagem-erro'

export type GrupoFaturasCartao = { cartao: Cartao; faturas: FaturaComTotal[] }

export function useCicloFatura(onSucesso: (fatura: Fatura) => void) {
  const [loading, setLoading] = useState(false)
  // O erro guarda de qual fatura é. O painel fica montado ao trocar de fatura,
  // e este hook vive nele: um erro solto acompanharia a navegação, e o "Fatura
  // já está paga" de setembro apareceria na faixa de novembro.
  const [falha, setFalha] = useState<{ faturaId: number; mensagem: string } | null>(null)

  // Devolve se deu certo: o diálogo de pagamento só fecha nesse caso, e o erro
  // fica nele. `mensagemErro` tira o prefixo com que o Electron embrulha o erro
  // do main — sem isso o resumo mostrava "Error invoking remote method…".
  async function executar(faturaId: number, acao: () => Promise<Fatura>): Promise<boolean> {
    setLoading(true)
    setFalha(null)
    try {
      const fatura = await acao()
      onSucesso(fatura)
      return true
    } catch (e) {
      setFalha({ faturaId, mensagem: mensagemErro(e, 'Erro ao atualizar a fatura.') })
      return false
    } finally {
      setLoading(false)
    }
  }

  function fechar(faturaId: number) {
    return executar(faturaId, () => window.api.fatura.fechar(faturaId))
  }

  function pagar(faturaId: number, dataPagamento: string) {
    return executar(faturaId, () => window.api.fatura.pagar(faturaId, dataPagamento))
  }

  function reabrir(faturaId: number) {
    return executar(faturaId, () => window.api.fatura.reabrir(faturaId))
  }

  /** O erro da última ação, se ela foi nesta fatura. */
  function erroDa(faturaId: number): string | null {
    return falha?.faturaId === faturaId ? falha.mensagem : null
  }

  return { fechar, pagar, reabrir, loading, erroDa }
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
  // Cada nova tentativa refaz a leitura. Ela era feita uma vez só, e a falha
  // deixava a tela num erro sem saída.
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    window.api.cartao
      .list({ incluirArquivados: true })
      .then((data) => {
        if (!ativo) return
        setCartoes(data)
        setErro(null)
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
  }, [tentativa])

  const recarregar = useCallback(() => {
    setLoading(true)
    setTentativa((n) => n + 1)
  }, [])

  return { cartoes, loading, erro, recarregar }
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

/**
 * O detalhe da fatura em foco. Enquanto a seguinte carrega, `detalhe` segue
 * sendo o da anterior: é o que deixa o painel na tela ao trocar de fatura, em
 * vez de desmontá-lo — e levar junto a seta que tinha o foco.
 */
export function useFaturaDetalhe(faturaId: number | null) {
  const [detalhe, setDetalhe] = useState<FaturaDetalhada | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Só a resposta do último pedido vale. Com o painel montado durante a troca,
  // a resposta lenta de uma fatura anterior chegaria depois e cobriria a nova.
  const ultimoPedido = useRef(0)

  const refetch = useCallback(async () => {
    const pedido = ++ultimoPedido.current
    if (faturaId === null) {
      setDetalhe(null)
      setErro(null)
      // O pedido que ainda estava a caminho foi descartado acima, e não vai
      // encerrar o carregamento por conta própria.
      setLoading(false)
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const data = await window.api.fatura.detalharComParcelas(faturaId)
      if (pedido !== ultimoPedido.current) return
      setDetalhe(data)
    } catch (e) {
      if (pedido !== ultimoPedido.current) return
      setErro(mensagemErro(e, 'Erro ao carregar a fatura.'))
      setDetalhe(null)
    } finally {
      if (pedido === ultimoPedido.current) setLoading(false)
    }
  }, [faturaId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { detalhe, loading, erro, refetch }
}
