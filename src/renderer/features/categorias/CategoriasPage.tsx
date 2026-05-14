import { useState } from 'react'
import type { Categoria } from '@domain/entities/categoria'
import type { CategoriaInput } from '@shared/ipc/categoria'
import { useCategorias } from './hooks/use-categorias'
import { CategoriaForm } from './CategoriaForm'
import { CategoriaList } from './CategoriaList'
import styles from './categorias.module.css'

type Modo = { kind: 'criar' } | { kind: 'editar'; categoria: Categoria }

export default function CategoriasPage() {
  const {
    categorias,
    loading,
    error,
    incluirArquivados,
    setIncluirArquivados,
    criar,
    atualizar,
    arquivar,
    desarquivar
  } = useCategorias()
  const [modo, setModo] = useState<Modo>({ kind: 'criar' })

  async function handleSalvar(input: CategoriaInput) {
    if (modo.kind === 'criar') {
      await criar(input)
    } else {
      await atualizar(modo.categoria.id, input)
    }
    setModo({ kind: 'criar' })
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>Categorias</h1>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={incluirArquivados}
            onChange={(e) => setIncluirArquivados(e.target.checked)}
          />
          Mostrar arquivados
        </label>
      </div>

      <div className={styles.layout}>
        <section className={styles.listSection}>
          {loading && <p className={styles.empty}>Carregando…</p>}
          {error && <p className={styles.errorMsg}>{error}</p>}
          {!loading && !error && (
            <CategoriaList
              categorias={categorias}
              onEditar={(c) => setModo({ kind: 'editar', categoria: c })}
              onArquivar={arquivar}
              onDesarquivar={desarquivar}
            />
          )}
        </section>

        <section className={styles.formSection}>
          <CategoriaForm
            key={modo.kind === 'editar' ? modo.categoria.id : 'nova'}
            mode={modo.kind}
            categoriaInicial={modo.kind === 'editar' ? modo.categoria : undefined}
            onSalvar={handleSalvar}
            onCancelar={() => setModo({ kind: 'criar' })}
          />
        </section>
      </div>
    </div>
  )
}
