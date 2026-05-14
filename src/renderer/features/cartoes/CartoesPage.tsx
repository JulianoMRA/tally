import { useState } from 'react'
import type { Cartao } from '@domain/entities/cartao'
import type { CartaoInput } from '@shared/ipc/cartao'
import { useCartoes } from './hooks/use-cartoes'
import { CartaoForm } from './CartaoForm'
import { CartaoList } from './CartaoList'
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

  async function handleSalvar(input: CartaoInput) {
    if (modo.kind === 'criar') {
      await criar(input)
    } else {
      await atualizar(modo.cartao.id, input)
    }
    setModo({ kind: 'criar' })
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>Cartões</h1>
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
            <CartaoList
              cartoes={cartoes}
              onEditar={(c) => setModo({ kind: 'editar', cartao: c })}
              onArquivar={arquivar}
              onDesarquivar={desarquivar}
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
    </div>
  )
}
