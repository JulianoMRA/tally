import { useState } from 'react'
import type { Contribuidor } from '@domain/entities/contribuidor'
import type { ContribuidorInput } from '@shared/ipc/contribuidor'
import { useContribuidores } from './hooks/use-contribuidores'
import { ContribuidorForm } from './ContribuidorForm'
import { ContribuidorList } from './ContribuidorList'
import { PageHead } from '../../components/layout/PageHead'
import styles from './contribuidores.module.css'

type Modo = { kind: 'criar' } | { kind: 'editar'; contribuidor: Contribuidor }

export default function ContribuidoresPage() {
  const {
    contribuidores,
    loading,
    error,
    incluirArquivados,
    setIncluirArquivados,
    criar,
    atualizar,
    arquivar,
    desarquivar
  } = useContribuidores()
  const [modo, setModo] = useState<Modo>({ kind: 'criar' })

  async function handleSalvar(input: ContribuidorInput) {
    if (modo.kind === 'criar') {
      await criar(input)
    } else {
      await atualizar(modo.contribuidor.id, input)
    }
    setModo({ kind: 'criar' })
  }

  return (
    <div>
      <PageHead
        title="Contribuidores"
        subtitle="Pessoas que ajudam a pagar parte das suas despesas."
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
            <ContribuidorList
              contribuidores={contribuidores}
              onEditar={(c) => setModo({ kind: 'editar', contribuidor: c })}
              onArquivar={arquivar}
              onDesarquivar={desarquivar}
            />
          )}
        </section>

        <section className={styles.formSection}>
          <ContribuidorForm
            key={modo.kind === 'editar' ? modo.contribuidor.id : 'novo'}
            mode={modo.kind}
            contribuidorInicial={modo.kind === 'editar' ? modo.contribuidor : undefined}
            onSalvar={handleSalvar}
            onCancelar={() => setModo({ kind: 'criar' })}
          />
        </section>
      </div>
    </div>
  )
}
