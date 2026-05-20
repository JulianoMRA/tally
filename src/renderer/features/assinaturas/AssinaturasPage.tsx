import { useEffect, useState } from 'react'
import type { Cartao } from '@domain/entities/cartao'
import type { Categoria } from '@domain/entities/categoria'
import type { Despesa } from '@domain/entities/despesa'
import { PageHead } from '../../components/layout/PageHead'
import { Badge, Button, EmptyState, Panel } from '../../components/ui'
import { useAssinaturas } from './hooks/use-assinaturas'
import { ReajustarValorModal } from './ReajustarValorModal'
import styles from './assinaturas.module.css'

function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function AssinaturasPage() {
  const { assinaturas, loading, erro, recarregar } = useAssinaturas()
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [filtroAtivas, setFiltroAtivas] = useState(true)
  const [reajustando, setReajustando] = useState<Despesa | null>(null)
  const [acaoErro, setAcaoErro] = useState<string | null>(null)

  useEffect(() => {
    window.api.cartao.list({ incluirArquivados: true }).then(setCartoes)
    window.api.categoria.list().then(setCategorias)
  }, [])

  const exibidas = assinaturas.filter((a) => (filtroAtivas ? a.ativa : !a.ativa))

  async function handleCancelar(assinatura: Despesa) {
    const ok = window.confirm(
      `Cancelar a assinatura "${assinatura.descricao}"? ` +
        'As ocorrências em faturas abertas serão removidas. ' +
        'Ocorrências em faturas já fechadas ou pagas permanecem no histórico.'
    )
    if (!ok) return
    setAcaoErro(null)
    try {
      await window.api.despesa.cancelarAssinatura({ despesaId: assinatura.id })
      await recarregar()
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : 'Erro ao cancelar assinatura.')
    }
  }

  async function handleExcluir(assinatura: Despesa) {
    const ok = window.confirm(
      `Excluir definitivamente a assinatura "${assinatura.descricao}" e TODAS as parcelas pendentes? ` +
        'Esta ação é irreversível. Bloqueia se houver parcela já paga.'
    )
    if (!ok) return
    setAcaoErro(null)
    try {
      await window.api.despesa.excluir({ despesaId: assinatura.id })
      await recarregar()
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : 'Erro ao excluir assinatura.')
    }
  }

  async function handleReajustarConfirmar(novoValorCentavos: number) {
    if (!reajustando) return
    await window.api.despesa.reajustarValorMensalAssinatura({
      despesaId: reajustando.id,
      novoValorCentavos
    })
    setReajustando(null)
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
        {acaoErro && <p className={styles.erro}>{acaoErro}</p>}

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
                      {a.dataCompra}
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
                        <Button variant="ghost" size="sm" onClick={() => setReajustando(a)}>
                          Reajustar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleCancelar(a)}>
                          Cancelar
                        </Button>
                      </>
                    )}
                    <Button variant="danger" size="sm" onClick={() => handleExcluir(a)}>
                      Excluir
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {reajustando && (
          <ReajustarValorModal
            descricao={reajustando.descricao}
            valorAtualCentavos={reajustando.valorCentavos}
            onConfirmar={handleReajustarConfirmar}
            onCancelar={() => setReajustando(null)}
          />
        )}
      </div>
    </div>
  )
}
