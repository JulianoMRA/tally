import { useEffect, useState } from 'react'
import type { Categoria } from '@domain/entities/categoria'

/**
 * Carrega categorias do tipo Renda ou Ambos.
 */
export function useCategoriasRenda() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      window.api.categoria.list({ tipo: 'Renda' }),
      window.api.categoria.list({ tipo: 'Ambos' })
    ])
      .then(([renda, ambos]) => {
        const map = new Map<number, Categoria>()
        for (const c of [...renda, ...ambos]) map.set(c.id, c)
        setCategorias([...map.values()].sort((a, b) => a.nome.localeCompare(b.nome)))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { categorias, loading }
}
