import type { Renda } from '@domain/entities/renda'
import { useListaArquivavel } from '../../../hooks/use-lista-arquivavel'

export function useRendas() {
  // O IPC de renda usa `incluirArquivadas` (feminino), diferente de cartão e
  // categoria — por isso quem monta o argumento é quem chama, e não o hook.
  const { itens, loading, error, incluirArquivados, setIncluirArquivados, refetch } =
    useListaArquivavel<Renda>(
      (incluirArquivadas) => window.api.renda.list({ incluirArquivadas }),
      'Erro ao listar rendas.'
    )

  return {
    rendas: itens,
    loading,
    error,
    incluirArquivadas: incluirArquivados,
    setIncluirArquivadas: setIncluirArquivados,
    refetch
  }
}
