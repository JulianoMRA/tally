import { useState } from 'react'
import type { Cartao } from '@domain/entities/cartao'
import type { CartaoInput } from '@shared/ipc/cartao'
import { useCartoes } from './hooks/use-cartoes'
import { CartaoForm } from './CartaoForm'
import { CartaoList } from './CartaoList'
import { PageContainer } from '../../components/layout/PageContainer'
import { PageHead } from '../../components/layout/PageHead'
import { useToast } from '../../components/ui'
import { mensagemErro } from '../../lib/mensagem-erro'
import styles from './cartoes.module.css'

type Modo = { kind: 'criar' } | { kind: 'editar'; cartao: Cartao }

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
  const [modo, setModo] = useState<Modo>({ kind: 'criar' })
  const toast = useToast()

  async function handleSalvar(input: CartaoInput) {
    try {
      if (modo.kind === 'criar') {
        await criar(input)
        toast.show('Cartão criado.', 'success')
      } else {
        await atualizar(modo.cartao.id, input)
        toast.show('Cartão atualizado.', 'success')
      }
      setModo({ kind: 'criar' })
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao salvar cartão.'), 'error')
    }
  }

  async function handleArquivar(id: number) {
    try {
      await arquivar(id)
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao arquivar cartão.'), 'error')
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
            <CartaoList
              cartoes={cartoes}
              onEditar={(c) => setModo({ kind: 'editar', cartao: c })}
              onArquivar={handleArquivar}
              onDesarquivar={handleDesarquivar}
            />
          )}
        </section>

        <section className={styles.formSection}>
          <CartaoForm
            key={modo.kind === 'editar' ? modo.cartao.id : 'novo'}
            mode={modo.kind}
            cartaoInicial={modo.kind === 'editar' ? modo.cartao : undefined}
            onSalvar={handleSalvar}
            onCancelar={() => setModo({ kind: 'criar' })}
          />
        </section>
      </div>
    </PageContainer>
  )
}
