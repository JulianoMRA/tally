import { useState, useEffect } from 'react'
import type { Categoria } from '@domain/entities/categoria'

export function useCategoriasDespesa() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.categoria.list({ tipo: 'Despesa' }).then((data) => {
      setCategorias(data)
      setLoading(false)
    })
  }, [])

  return { categorias, loading }
}
