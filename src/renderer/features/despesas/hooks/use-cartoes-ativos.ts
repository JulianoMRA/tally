import { useState, useEffect } from 'react'
import type { Cartao } from '@domain/entities/cartao'
import { mensagemErro } from '../../../lib/mensagem-erro'

export function useCartoesAtivos() {
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Só havia caminho de sucesso aqui: um `.then` sem `.catch`. Numa falha do
  // IPC a rejeição ficava sem tratamento e `loading` nunca virava false — a
  // tela parava em "Carregando…" indefinidamente, sem dizer o que houve.
  useEffect(() => {
    let ativo = true
    window.api.cartao
      .list({ incluirArquivados: false })
      .then((data) => {
        if (!ativo) return
        setCartoes(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!ativo) return
        setError(mensagemErro(err, 'Erro ao listar cartões.'))
        setLoading(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  return { cartoes, loading, error }
}
