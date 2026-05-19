import { useCallback, useEffect, useState } from 'react'
import type { VisaoMensalDetalhada } from '@shared/ipc/visao-mensal'

export function useVisaoMensal(mesReferencia: string) {
  const [detalhe, setDetalhe] = useState<VisaoMensalDetalhada | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await window.api.visaoMensal.detalhar({ mesReferencia })
      setDetalhe(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar visão mensal.')
    } finally {
      setLoading(false)
    }
  }, [mesReferencia])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { detalhe, loading, erro, recarregar }
}
