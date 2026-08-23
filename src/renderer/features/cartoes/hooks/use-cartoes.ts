import { useCallback } from 'react'
import type { Cartao } from '@domain/entities/cartao'
import type { CartaoInput } from '@shared/ipc/cartao'
import { useListaArquivavel } from '../../../hooks/use-lista-arquivavel'

export function useCartoes() {
  const { itens, loading, error, incluirArquivados, setIncluirArquivados, refetch } =
    useListaArquivavel<Cartao>(
      (incluirArquivados) => window.api.cartao.list({ incluirArquivados }),
      'Erro ao listar cartões.'
    )

  const criar = useCallback(
    async (input: CartaoInput) => {
      await window.api.cartao.create(input)
      await refetch()
    },
    [refetch]
  )

  const atualizar = useCallback(
    async (id: number, input: CartaoInput) => {
      await window.api.cartao.update(id, input)
      await refetch()
    },
    [refetch]
  )

  const arquivar = useCallback(
    async (id: number) => {
      await window.api.cartao.arquivar(id)
      await refetch()
    },
    [refetch]
  )

  const desarquivar = useCallback(
    async (id: number) => {
      await window.api.cartao.desarquivar(id)
      await refetch()
    },
    [refetch]
  )

  return {
    cartoes: itens,
    loading,
    error,
    incluirArquivados,
    setIncluirArquivados,
    criar,
    atualizar,
    arquivar,
    desarquivar
  }
}
