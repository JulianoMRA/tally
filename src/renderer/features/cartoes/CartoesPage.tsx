import { useMemo, useState } from 'react'
import type { Cartao } from '@domain/entities/cartao'
import type { CartaoInput } from '@shared/ipc/cartao'
import { useCartoes } from './hooks/use-cartoes'
import { CartaoForm } from './CartaoForm'
import { CartaoList } from './CartaoList'
import { PageContainer } from '../../components/layout/PageContainer'
import { PageHead } from '../../components/layout/PageHead'
import { Button, ConfirmDialog, SidePanel, useToast } from '../../components/ui'
import { mensagemErro } from '../../lib/mensagem-erro'
import { mesAtualReferencia } from '../../lib/mes-atual'
import { useCartoesAtivos } from '../despesas/hooks/use-cartoes-ativos'
import { useFaturasDeTodosCartoes } from '../faturas/hooks/use-faturas'
import { resumirCartao } from './resumir-cartao'
import styles from './cartoes.module.css'

type Painel = { kind: 'fechado' } | { kind: 'criar' } | { kind: 'editar'; cartao: Cartao }

export default function CartoesPage() {
  const {
    cartoes,
    loading,
    error,
    incluirArquivados,
    setIncluirArquivados,
    criar,
    atualizar,
    arquivar,
    desarquivar
  } = useCartoes()
  const [painel, setPainel] = useState<Painel>({ kind: 'fechado' })
  const [confirmarArquivar, setConfirmarArquivar] = useState<Cartao | null>(null)
  const toast = useToast()

  const { cartoes: cartoesAtivos } = useCartoesAtivos()
  const { grupos } = useFaturasDeTodosCartoes(cartoesAtivos)
  const mesAtual = mesAtualReferencia()

  const resumos = useMemo(() => {
    const mapa = new Map<number, ReturnType<typeof resumirCartao>>()
    for (const g of grupos) mapa.set(g.cartao.id, resumirCartao(g.faturas, mesAtual))
    return mapa
  }, [grupos, mesAtual])

  async function handleSalvar(input: CartaoInput) {
    try {
      if (painel.kind === 'editar') {
        await atualizar(painel.cartao.id, input)
        toast.show('Cartão atualizado.', 'success')
      } else {
        await criar(input)
        toast.show('Cartão criado.', 'success')
      }
      setPainel({ kind: 'fechado' })
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao salvar cartão.'), 'error')
    }
  }

  // Arquivar tem consequência e saiu da linha para o menu ⋯, com confirmação
  // (ponto 14). Antes dividia a linha com Editar, no mesmo peso.
  async function handleArquivar(cartao: Cartao) {
    try {
      await arquivar(cartao.id)
      toast.show(`"${cartao.nome}" arquivado.`, 'success')
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao arquivar cartão.'), 'error')
    } finally {
      setConfirmarArquivar(null)
    }
  }

  async function handleDesarquivar(id: number) {
    try {
      await desarquivar(id)
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao desarquivar cartão.'), 'error')
    }
  }

  return (
    <PageContainer>
      <PageHead
        title="Cartões"
        subtitle="Gerencie seus cartões de crédito."
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
              + Novo cartão
            </Button>
          </>
        }
      />

      {/* Lista em largura cheia e cadastro sob demanda: o mesmo padrão de
          Saídas e Categorias (ponto 16). Antes eram layouts espelhados, com um
          formulário vazio ocupando 380px em toda visita. */}
      <div className={styles.layout}>
        {loading && <p className={styles.empty}>Carregando…</p>}
        {error && <p className={styles.errorMsg}>{error}</p>}
        {!loading && !error && (
          <CartaoList
            cartoes={cartoes}
            resumos={resumos}
            onEditar={(c) => setPainel({ kind: 'editar', cartao: c })}
            onArquivar={(c) => setConfirmarArquivar(c)}
            onDesarquivar={handleDesarquivar}
          />
        )}
      </div>

      {painel.kind !== 'fechado' && (
        <SidePanel
          titulo={painel.kind === 'criar' ? 'Novo cartão' : 'Editar cartão'}
          descricao="O dia de fechamento decide em qual fatura cada compra cai (RN-01)."
          onFechar={() => setPainel({ kind: 'fechado' })}
          fecharNoOverlay={false}
        >
          <CartaoForm
            key={painel.kind === 'editar' ? painel.cartao.id : 'novo'}
            cartaoInicial={painel.kind === 'editar' ? painel.cartao : undefined}
            onSalvar={handleSalvar}
            onCancelar={() => setPainel({ kind: 'fechado' })}
          />
        </SidePanel>
      )}

      {confirmarArquivar && (
        <ConfirmDialog
          title={`Arquivar "${confirmarArquivar.nome}"?`}
          body="O cartão some dos formulários de despesa, mas o histórico de faturas permanece visível. Dá para desarquivar depois."
          confirmText="Arquivar"
          confirmVariant="danger"
          onConfirm={() => handleArquivar(confirmarArquivar)}
          onCancel={() => setConfirmarArquivar(null)}
        />
      )}
    </PageContainer>
  )
}
