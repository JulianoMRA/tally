import { useEffect, useState } from 'react'
import type { Cartao } from '@domain/entities/cartao'
import type { Categoria } from '@domain/entities/categoria'
import type { Despesa } from '@domain/entities/despesa'
import { PageHead } from '../../components/layout/PageHead'
import { Badge, Button, ConfirmDialog, EmptyState, Panel, useToast } from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import { formatarDataIso } from '../../lib/formatar-data'
import { mensagemErro } from '../../lib/mensagem-erro'
import { useAssinaturas } from './hooks/use-assinaturas'
import { EditarAssinaturaModal } from './EditarAssinaturaModal'
import styles from './assinaturas.module.css'

type Confirmacao =
  | { tipo: 'cancelar'; assinatura: Despesa }
  | { tipo: 'excluir'; assinatura: Despesa }

export default function AssinaturasPage() {
  const { assinaturas, loading, erro, recarregar } = useAssinaturas()
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [filtroAtivas, setFiltroAtivas] = useState(true)
  const [editando, setEditando] = useState<Despesa | null>(null)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)
  const toast = useToast()

  useEffect(() => {
    window.api.cartao.list({ incluirArquivados: true }).then(setCartoes)
    window.api.categoria.list({ tipo: 'Despesa' }).then(setCategorias)
  }, [])

  const exibidas = assinaturas.filter((a) => (filtroAtivas ? a.ativa : !a.ativa))

  async function confirmarCancelar(assinatura: Despesa) {
    try {
      await window.api.despesa.cancelarAssinatura({ despesaId: assinatura.id })
      toast.show(`"${assinatura.descricao}" cancelada.`, 'success')
      await recarregar()
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao cancelar assinatura.'), 'error')
    } finally {
      setConfirmacao(null)
    }
  }

  async function confirmarExcluir(assinatura: Despesa) {
    try {
      await window.api.despesa.excluir({ despesaId: assinatura.id })
      toast.show(`"${assinatura.descricao}" excluída.`, 'success')
      await recarregar()
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao excluir assinatura.'), 'error')
    } finally {
      setConfirmacao(null)
    }
  }

  async function handleEditarConfirmar(input: {
    descricao: string
    categoriaId: number
    valorCentavos: number
  }) {
    if (!editando) return
    await window.api.despesa.atualizar({ despesaId: editando.id, ...input })
    toast.show('Assinatura atualizada.', 'success')
    setEditando(null)
    await recarregar()
  }

  function nomeCartao(id: number | null): string {
    if (id === null) return '—'
    return cartoes.find((c) => c.id === id)?.nome ?? `#${id}`
  }

  function corCartao(id: number | null): string | undefined {
    if (id === null) return undefined
    return cartoes.find((c) => c.id === id)?.cor
  }

  function nomeCategoria(id: number): string {
    return categorias.find((c) => c.id === id)?.nome ?? `#${id}`
  }

  return (
    <div>
      <PageHead title="Assinaturas" subtitle="Gerencie recorrências mensais no cartão." />

      <div className={styles.body}>
        <div className={styles.toolbar}>
          <Button
            variant={filtroAtivas ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFiltroAtivas(true)}
          >
            Ativas
          </Button>
          <Button
            variant={!filtroAtivas ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFiltroAtivas(false)}
          >
            Canceladas
          </Button>
        </div>

        {erro && <p className={styles.erro}>{erro}</p>}

        <Panel title={filtroAtivas ? 'Assinaturas ativas' : 'Assinaturas canceladas'} flush>
          {loading ? (
            <EmptyState title="Carregando…" />
          ) : exibidas.length === 0 ? (
            <EmptyState
              title={
                filtroAtivas ? 'Você não tem assinaturas ativas.' : 'Nenhuma assinatura cancelada.'
              }
            />
          ) : (
            <ul className={styles.lista}>
              {exibidas.map((a) => (
                <li key={a.id} className={`${styles.item} ${!a.ativa ? styles.itemCancelada : ''}`}>
                  <span className={styles.cardChip} style={{ background: corCartao(a.cartaoId) }} />
                  <div className={styles.info}>
                    <span className={styles.descricao}>{a.descricao}</span>
                    <span className={styles.meta}>
                      {nomeCartao(a.cartaoId)} · {nomeCategoria(a.categoriaId)} · início{' '}
                      {formatarDataIso(a.dataCompra)}
                    </span>
                  </div>
                  <span className={styles.valor}>{formatBRL(a.valorCentavos)}/mês</span>
                  <Badge
                    variant={a.ativa ? 'active' : 'archived'}
                    label={a.ativa ? 'Ativa' : 'Cancelada'}
                  />
                  <div className={styles.actions}>
                    {a.ativa && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setEditando(a)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmacao({ tipo: 'cancelar', assinatura: a })}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setConfirmacao({ tipo: 'excluir', assinatura: a })}
                    >
                      Excluir
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {editando && (
          <EditarAssinaturaModal
            assinatura={editando}
            categorias={categorias}
            onConfirmar={handleEditarConfirmar}
            onCancelar={() => setEditando(null)}
          />
        )}

        {confirmacao?.tipo === 'cancelar' && (
          <ConfirmDialog
            title={`Cancelar "${confirmacao.assinatura.descricao}"?`}
            body="As ocorrências em faturas abertas serão removidas. Ocorrências em faturas já fechadas ou pagas permanecem no histórico."
            confirmText="Cancelar assinatura"
            confirmVariant="danger"
            onConfirm={() => confirmarCancelar(confirmacao.assinatura)}
            onCancel={() => setConfirmacao(null)}
          />
        )}
        {confirmacao?.tipo === 'excluir' && (
          <ConfirmDialog
            title={`Excluir "${confirmacao.assinatura.descricao}"?`}
            body="A assinatura e TODAS as parcelas pendentes serão removidas. Esta ação é irreversível e bloqueia se houver parcela já paga."
            confirmText="Excluir"
            confirmVariant="danger"
            onConfirm={() => confirmarExcluir(confirmacao.assinatura)}
            onCancel={() => setConfirmacao(null)}
          />
        )}
      </div>
    </div>
  )
}
