import { useState } from 'react'
import { Button, Field, Input } from '../../components/ui'
import { useEscapeKey } from '../../hooks/use-escape-key'
import styles from './assinaturas.module.css'

type Props = {
  descricao: string
  valorAtualCentavos: number
  onConfirmar: (novoValorCentavos: number) => Promise<void>
  onCancelar: () => void
}

function parseCentavos(reais: string): number {
  return Math.round(parseFloat(reais.replace(',', '.')) * 100)
}

function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ReajustarValorModal({
  descricao,
  valorAtualCentavos,
  onConfirmar,
  onCancelar
}: Props) {
  const [valorReais, setValorReais] = useState(
    (valorAtualCentavos / 100).toFixed(2).replace('.', ',')
  )
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  useEscapeKey(onCancelar)

  async function handleConfirmar() {
    if (!/^\d+([.,]\d{1,2})?$/.test(valorReais)) {
      setErro('Valor inválido.')
      return
    }
    const centavos = parseCentavos(valorReais)
    if (centavos <= 0) {
      setErro('Valor deve ser maior que zero.')
      return
    }
    setErro(null)
    setLoading(true)
    try {
      await onConfirmar(centavos)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao reajustar valor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3 className={styles.modalTitle}>Reajustar valor mensal</h3>
        <p className={styles.modalDesc}>
          <strong>{descricao}</strong> — valor atual {formatBRL(valorAtualCentavos)}. O novo valor
          será aplicado às parcelas pendentes em faturas abertas.
        </p>

        <Field label="Novo valor mensal (R$)">
          <Input
            type="text"
            inputMode="decimal"
            value={valorReais}
            onChange={(e) => setValorReais(e.target.value)}
            autoFocus
          />
        </Field>

        {erro && <p className={styles.erro}>{erro}</p>}

        <div className={styles.modalActions}>
          <Button variant="ghost" size="sm" onClick={onCancelar} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Aplicando…' : 'Aplicar reajuste'}
          </Button>
        </div>
      </div>
    </div>
  )
}
