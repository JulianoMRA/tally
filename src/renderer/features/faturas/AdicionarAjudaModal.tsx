import { useEffect, useState } from 'react'
import type { Contribuidor } from '@domain/entities/contribuidor'
import { Button, Field, Input, Select } from '../../components/ui'
import styles from './faturas.module.css'

type Props = {
  parcelaId: number
  numeroParcela: number
  totalParcelas: number | null
  permitirReplicar: boolean
  onConfirmar: (input: {
    contribuidorId: number
    valorCentavos: number
    recorrente: boolean
  }) => Promise<void>
  onCancelar: () => void
}

function parseCentavos(reais: string): number {
  return Math.round(parseFloat(reais.replace(',', '.')) * 100)
}

export function AdicionarAjudaModal({
  parcelaId: _parcelaId,
  numeroParcela,
  totalParcelas,
  permitirReplicar,
  onConfirmar,
  onCancelar
}: Props) {
  const [contribuidores, setContribuidores] = useState<Contribuidor[]>([])
  const [contribuidorId, setContribuidorId] = useState<string>('')
  const [valorReais, setValorReais] = useState('')
  const [recorrente, setRecorrente] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    window.api.contribuidor
      .list({ incluirArquivados: false })
      .then(setContribuidores)
      .catch((e) => setErro(e instanceof Error ? e.message : String(e)))
  }, [])

  async function handleConfirmar() {
    const cId = parseInt(contribuidorId, 10)
    if (isNaN(cId) || cId <= 0) {
      setErro('Selecione um contribuidor.')
      return
    }
    if (!/^\d+([.,]\d{1,2})?$/.test(valorReais)) {
      setErro('Valor inválido.')
      return
    }
    const valor = parseCentavos(valorReais)
    if (valor <= 0) {
      setErro('Valor deve ser maior que zero.')
      return
    }
    setErro(null)
    setLoading(true)
    try {
      await onConfirmar({ contribuidorId: cId, valorCentavos: valor, recorrente })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar ajuda.')
    } finally {
      setLoading(false)
    }
  }

  const totalLabel = totalParcelas === null ? '?' : totalParcelas

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3 className={styles.modalTitle}>
          Adicionar ajuda · parcela {numeroParcela}/{totalLabel}
        </h3>
        <p className={styles.modalDesc}>
          Vincule um contribuidor que paga parte desta parcela. Não conta como entrada — apenas
          abate do líquido da fatura.
        </p>

        <div className={styles.modalFields}>
          <Field label="Contribuidor">
            <Select value={contribuidorId} onChange={(e) => setContribuidorId(e.target.value)}>
              <option value="">Selecione…</option>
              {contribuidores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Valor (R$)">
            <Input
              type="text"
              inputMode="decimal"
              value={valorReais}
              onChange={(e) => setValorReais(e.target.value)}
              placeholder="0,00"
            />
          </Field>

          {permitirReplicar && (
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={recorrente}
                onChange={(e) => setRecorrente(e.target.checked)}
              />
              Replicar nas próximas parcelas (fatura Aberta)
            </label>
          )}
        </div>

        {erro && <p className={styles.erroAcao}>{erro}</p>}

        <div className={styles.modalActions}>
          <Button variant="ghost" size="sm" onClick={onCancelar} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Adicionando…' : 'Adicionar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
