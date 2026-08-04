import { useState } from 'react'
import type { Categoria } from '@domain/entities/categoria'
import type { CategoriaInput } from '@shared/ipc/categoria'
import { useCategorias } from './hooks/use-categorias'
import { CategoriaForm } from './CategoriaForm'
import { CategoriaList } from './CategoriaList'
import { PageContainer } from '../../components/layout/PageContainer'
import { PageHead } from '../../components/layout/PageHead'
import { useToast } from '../../components/ui'
import { mensagemErro } from '../../lib/mensagem-erro'
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
  const toast = useToast()

  async function handleSalvar(input: CategoriaInput) {
    try {
      if (modo.kind === 'criar') {
        await criar(input)
        toast.show('Categoria criada.', 'success')
      } else {
        await atualizar(modo.categoria.id, input)
        toast.show('Categoria atualizada.', 'success')
      }
      setModo({ kind: 'criar' })
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao salvar categoria.'), 'error')
    }
  }

  async function handleArquivar(id: number) {
    try {
      await arquivar(id)
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao arquivar categoria.'), 'error')
    }
  }

  async function handleDesarquivar(id: number) {
    try {
      await desarquivar(id)
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao desarquivar categoria.'), 'error')
    }
  }

  return (
    <PageContainer>
      <PageHead
        title="Categorias"
        subtitle="Organize seus gastos e receitas por categoria."
        actions={
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={incluirArquivados}
              onChange={(e) => setIncluirArquivados(e.target.checked)}
            />
            Mostrar arquivados
          </label>
        }
      />

      <div className={styles.layout}>
        <section className={styles.listSection}>
          {loading && <p className={styles.empty}>Carregando…</p>}
          {error && <p className={styles.errorMsg}>{error}</p>}
          {!loading && !error && (
            <CategoriaList
              categorias={categorias}
              onEditar={(c) => setModo({ kind: 'editar', categoria: c })}
              onArquivar={handleArquivar}
              onDesarquivar={handleDesarquivar}
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
    </PageContainer>
  )
}
