import { useState } from 'react'
import { Button, Field, Input } from '../../components/ui'
import styles from './rendas.module.css'

type Props = {
  descricao: string
  valorReais: string
  onConfirmar: (dataRecebida: string) => Promise<void>
  onCancelar: () => void
}

function dataHoje(): string {
  return new Date().toISOString().slice(0, 10)
}

export function MarcarRecebidoModal({ descricao, valorReais, onConfirmar, onCancelar }: Props) {
  const [data, setData] = useState(dataHoje)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleConfirmar() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      setErro('Data inválida.')
      return
    }
    setErro(null)
    setLoading(true)
    try {
      await onConfirmar(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao marcar como recebido.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3 className={styles.modalTitle}>Marcar recebimento</h3>
        <p className={styles.modalDesc}>
          <strong>{descricao}</strong> — {valorReais}
        </p>

        <Field label="Data de recebimento">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} autoFocus />
        </Field>

        {erro && <p className={styles.erro}>{erro}</p>}

        <div className={styles.modalActions}>
          <Button variant="ghost" size="sm" onClick={onCancelar} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Confirmando…' : 'Marcar recebido'}
          </Button>
        </div>
      </div>
    </div>
  )
}
