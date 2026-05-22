import { useState } from 'react'
import { Button, Field, Input } from '../../components/ui'
import { useEscapeKey } from '../../hooks/use-escape-key'
import styles from './faturas.module.css'

type Props = {
  faturaDestinoId: number
  onConfirmar: (despesaId: number, quantidade: number) => Promise<void>
  onCancelar: () => void
}

export function AdiantarParcelasModal({
  faturaDestinoId: _faturaDestinoId,
  onConfirmar,
  onCancelar
}: Props) {
  const [despesaId, setDespesaId] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  useEscapeKey(onCancelar)

  async function handleConfirmar() {
    const dId = parseInt(despesaId, 10)
    const qtd = parseInt(quantidade, 10)
    if (isNaN(dId) || dId <= 0) {
      setErro('Informe um ID de despesa válido.')
      return
    }
    if (isNaN(qtd) || qtd <= 0) {
      setErro('Quantidade deve ser maior que zero.')
      return
    }
    setErro(null)
    setLoading(true)
    try {
      await onConfirmar(dId, qtd)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao adiantar parcelas.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3 className={styles.modalTitle}>Adiantar parcelas para esta fatura</h3>
        <p className={styles.modalDesc}>
          As parcelas mais futuras da despesa serão movidas para esta fatura.
        </p>

        <div className={styles.modalFields}>
          <Field label="ID da despesa parcelada">
            <Input
              type="number"
              min={1}
              value={despesaId}
              onChange={(e) => setDespesaId(e.target.value)}
              placeholder="Ex: 3"
            />
          </Field>

          <Field label="Quantidade de parcelas">
            <Input
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </Field>
        </div>

        {erro && <p className={styles.erroAcao}>{erro}</p>}

        <div className={styles.modalActions}>
          <Button variant="ghost" size="sm" onClick={onCancelar} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Adiantando…' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
