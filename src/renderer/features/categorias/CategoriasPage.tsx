import { useState } from 'react'
import type { Categoria } from '@domain/entities/categoria'
import type { CategoriaInput } from '@shared/ipc/categoria'
import { useCategorias } from './hooks/use-categorias'
import { CategoriaForm } from './CategoriaForm'
import { CategoriaList } from './CategoriaList'
import { PageContainer } from '../../components/layout/PageContainer'
import { PageHead } from '../../components/layout/PageHead'
import { Button, ConfirmDialog, SidePanel, useToast } from '../../components/ui'
import { mensagemErro } from '../../lib/mensagem-erro'
import styles from './categorias.module.css'

type Painel = { kind: 'fechado' } | { kind: 'criar' } | { kind: 'editar'; categoria: Categoria }

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
  const [painel, setPainel] = useState<Painel>({ kind: 'fechado' })
  const [confirmarArquivar, setConfirmarArquivar] = useState<Categoria | null>(null)
  const toast = useToast()

  async function handleSalvar(input: CategoriaInput) {
    try {
      if (painel.kind === 'editar') {
        await atualizar(painel.categoria.id, input)
        toast.show('Categoria atualizada.', 'success')
      } else {
        await criar(input)
        toast.show('Categoria criada.', 'success')
      }
      setPainel({ kind: 'fechado' })
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao salvar categoria.'), 'error')
    }
  }

  // Arquivar sai da linha para o menu ⋯, com confirmação (ponto 14).
  async function handleArquivar(categoria: Categoria) {
    try {
      await arquivar(categoria.id)
      toast.show(`"${categoria.nome}" arquivada.`, 'success')
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao arquivar categoria.'), 'error')
    } finally {
      setConfirmarArquivar(null)
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
          <>
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={incluirArquivados}
                onChange={(e) => setIncluirArquivados(e.target.checked)}
              />
              Mostrar arquivados
            </label>
            <Button size="sm" onClick={() => setPainel({ kind: 'criar' })}>
              + Nova categoria
            </Button>
          </>
        }
      />

      {/* Mesmo padrão de Cartões e Saídas: lista em largura cheia, cadastro em
          painel sob demanda (ponto 16). */}
      <div className={styles.layout}>
        {loading && <p className={styles.empty}>Carregando…</p>}
        {error && <p className={styles.errorMsg}>{error}</p>}
        {!loading && !error && (
          <CategoriaList
            categorias={categorias}
            onEditar={(c) => setPainel({ kind: 'editar', categoria: c })}
            onArquivar={(c) => setConfirmarArquivar(c)}
            onDesarquivar={handleDesarquivar}
          />
        )}
      </div>

      {painel.kind !== 'fechado' && (
        <SidePanel
          titulo={painel.kind === 'criar' ? 'Nova categoria' : 'Editar categoria'}
          descricao="O tipo decide em quais formulários a categoria aparece."
          onFechar={() => setPainel({ kind: 'fechado' })}
          fecharNoOverlay={false}
        >
          <CategoriaForm
            key={painel.kind === 'editar' ? painel.categoria.id : 'nova'}
            categoriaInicial={painel.kind === 'editar' ? painel.categoria : undefined}
            onSalvar={handleSalvar}
            onCancelar={() => setPainel({ kind: 'fechado' })}
          />
        </SidePanel>
      )}

      {confirmarArquivar && (
        <ConfirmDialog
          title={`Arquivar "${confirmarArquivar.nome}"?`}
          body="A categoria some dos formulários, mas despesas e rendas já classificadas continuam exibindo-a com indicador de inativa (RF-CAT-02)."
          confirmText="Arquivar"
          confirmVariant="danger"
          onConfirm={() => handleArquivar(confirmarArquivar)}
          onCancel={() => setConfirmarArquivar(null)}
        />
      )}
    </PageContainer>
  )
}
