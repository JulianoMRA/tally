import type { Ajuda } from '@domain/entities/ajuda'
import type { Contribuidor } from '@domain/entities/contribuidor'
import styles from './faturas.module.css'

function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type Props = {
  ajuda: Ajuda
  contribuidor: Contribuidor | undefined
  onExcluir: (ajudaId: number) => void
}

export function AjudaChip({ ajuda, contribuidor, onExcluir }: Props) {
  const nome = contribuidor?.nome ?? `#${ajuda.contribuidorId}`
  const recebida = ajuda.status === 'Recebida'
  const classe = recebida ? `${styles.ajudaChip} ${styles.ajudaChipRecebida}` : styles.ajudaChip

  function handleExcluir() {
    if (!window.confirm(`Excluir ajuda de ${nome} (${formatBRL(ajuda.valorCentavos)})?`)) return
    onExcluir(ajuda.id)
  }

  return (
    <span className={classe} title={recebida ? `Recebida em ${ajuda.dataRecebimento}` : 'Pendente'}>
      <span className={styles.ajudaChipNome}>{nome}</span>
      <span className={styles.ajudaChipValor}>{formatBRL(ajuda.valorCentavos)}</span>
      <button
        type="button"
        className={styles.ajudaChipExcluir}
        aria-label="Excluir ajuda"
        onClick={handleExcluir}
      >
        ×
      </button>
    </span>
  )
}
