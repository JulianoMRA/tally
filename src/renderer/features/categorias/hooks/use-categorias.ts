import { useCallback } from 'react'
import type { Categoria } from '@domain/entities/categoria'
import type { CategoriaInput } from '@shared/ipc/categoria'
import { useListaArquivavel } from '../../../hooks/use-lista-arquivavel'

export function useCategorias() {
  const { itens, loading, error, incluirArquivados, setIncluirArquivados, refetch } =
    useListaArquivavel<Categoria>(
      (incluirArquivados) => window.api.categoria.list({ incluirArquivados }),
      'Erro ao listar categorias.'
    )

  const criar = useCallback(
    async (input: CategoriaInput) => {
      await window.api.categoria.create(input)
      await refetch()
    },
    [refetch]
  )

  const atualizar = useCallback(
    async (id: number, input: CategoriaInput) => {
      await window.api.categoria.update(id, input)
      await refetch()
    },
    [refetch]
  )

  const arquivar = useCallback(
    async (id: number) => {
      await window.api.categoria.arquivar(id)
      await refetch()
    },
    [refetch]
  )

  const desarquivar = useCallback(
    async (id: number) => {
      await window.api.categoria.desarquivar(id)
      await refetch()
    },
    [refetch]
  )

  return {
    categorias: itens,
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
