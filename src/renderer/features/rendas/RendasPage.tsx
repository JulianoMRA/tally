import type { CriarRendaAvulsaInput, CriarRendaRecorrenteInput } from '@shared/ipc/renda'
import { useRendas } from './hooks/use-rendas'
import { RendaForm } from './RendaForm'
import { RendaList } from './RendaList'
import { PageHead } from '../../components/layout/PageHead'
import styles from './rendas.module.css'

export default function RendasPage() {
  const { rendas, loading, error, incluirArquivadas, setIncluirArquivadas, refetch } = useRendas()

  async function handleSalvarAvulsa(input: CriarRendaAvulsaInput) {
    await window.api.renda.criarAvulsa(input)
    await refetch()
  }

  async function handleSalvarRecorrente(input: CriarRendaRecorrenteInput) {
    await window.api.renda.criarRecorrente(input)
    await refetch()
  }

  async function handleArquivar(id: number) {
    await window.api.renda.arquivar(id)
    await refetch()
  }

  async function handleDesarquivar(id: number) {
    await window.api.renda.desarquivar(id)
    await refetch()
  }

  return (
    <div>
      <PageHead
        title="Rendas"
        subtitle="Fontes de entrada — recorrentes (bolsa, salário) ou avulsas (freela, presente)."
        actions={
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={incluirArquivadas}
              onChange={(e) => setIncluirArquivadas(e.target.checked)}
            />
            Mostrar arquivadas
          </label>
        }
      />

      <div className={styles.layout}>
        <section className={styles.listSection}>
          {loading && <p className={styles.empty}>Carregando…</p>}
          {error && <p className={styles.errorMsg}>{error}</p>}
          {!loading && !error && (
            <RendaList
              rendas={rendas}
              onArquivar={handleArquivar}
              onDesarquivar={handleDesarquivar}
            />
          )}
        </section>

        <section className={styles.formSection}>
          <RendaForm
            onSalvarAvulsa={handleSalvarAvulsa}
            onSalvarRecorrente={handleSalvarRecorrente}
          />
        </section>
      </div>
    </div>
  )
}
