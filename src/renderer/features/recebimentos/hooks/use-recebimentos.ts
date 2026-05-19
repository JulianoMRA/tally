import { useCallback, useEffect, useState } from 'react'
import type { StatusRecebimento } from '@domain/entities/recebimento'
import type { RecebimentoComContexto } from '@shared/ipc/recebimento'

type Filtro = {
  mesReferencia: string
  status?: StatusRecebimento
}

export function useRecebimentos(filtro: Filtro) {
  const [lista, setLista] = useState<RecebimentoComContexto[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await window.api.recebimento.listar({
        mesReferencia: filtro.mesReferencia,
        status: filtro.status
      })
      setLista(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar recebimentos.')
    } finally {
      setLoading(false)
    }
  }, [filtro.mesReferencia, filtro.status])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { recebimentos: lista, loading, erro, recarregar }
}
