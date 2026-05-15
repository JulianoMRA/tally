import { useState, useEffect } from 'react'
import type { Cartao } from '@domain/entities/cartao'

export function useCartoesAtivos() {
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.cartao.list({ incluirArquivados: false }).then((data) => {
      setCartoes(data)
      setLoading(false)
    })
  }, [])

  return { cartoes, loading }
}
