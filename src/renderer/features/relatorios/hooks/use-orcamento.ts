import { useCallback, useEffect, useState } from 'react'
import type { LinhaOrcamento } from '@domain/services/calcular-orcamento'
import type { DefinirLimiteInput } from '@shared/ipc/orcamento'

export function useOrcamento(mesReferencia: string) {
  const [progresso, setProgresso] = useState<LinhaOrcamento[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await window.api.orcamento.listarProgresso({ mesReferencia })
      setProgresso(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar orçamento.')
    } finally {
      setLoading(false)
    }
  }, [mesReferencia])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  const definirLimite = useCallback(
    async (input: DefinirLimiteInput) => {
      await window.api.orcamento.definirLimite(input)
      await recarregar()
    },
    [recarregar]
  )

  const removerLimite = useCallback(
    async (categoriaId: number) => {
      await window.api.orcamento.removerLimite(categoriaId)
      await recarregar()
    },
    [recarregar]
  )

  return { progresso, loading, erro, definirLimite, removerLimite, recarregar }
}
