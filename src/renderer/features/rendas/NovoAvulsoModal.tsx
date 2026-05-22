import { useState } from 'react'
import type { CriarRecebimentoAvulsoInput } from '@shared/ipc/recebimento'
import { Button, Field, Input } from '../../components/ui'
import { useEscapeKey } from '../../hooks/use-escape-key'
import styles from './rendas.module.css'

type Props = {
  onConfirmar: (input: CriarRecebimentoAvulsoInput) => Promise<void>
  onCancelar: () => void
}

function parseCentavos(reais: string): number {
  return Math.round(parseFloat(reais.replace(',', '.')) * 100)
}

function dataHoje(): string {
  return new Date().toISOString().slice(0, 10)
}

export function NovoAvulsoModal({ onConfirmar, onCancelar }: Props) {
  const [nome, setNome] = useState('')
  const [valorReais, setValorReais] = useState('')
  const [dataEsperada, setDataEsperada] = useState(dataHoje)
  const [jaRecebido, setJaRecebido] = useState(true)
  const [dataRecebida, setDataRecebida] = useState(dataHoje)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  useEscapeKey(onCancelar)

  async function handleConfirmar() {
    if (!nome.trim()) {
      setErro('Descrição é obrigatória.')
      return
    }
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
      await onConfirmar({
        nome: nome.trim(),
        valorCentavos: centavos,
        dataEsperada,
        dataRecebida: jaRecebido ? dataRecebida : undefined
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar recebimento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3 className={styles.modalTitle}>Novo recebimento avulso</h3>
        <p className={styles.modalDesc}>
          Para entradas sem fonte recorrente: freela, presente, venda etc.
        </p>

        <Field label="Descrição">
          <Input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Freela X"
            autoFocus
          />
        </Field>

        <div className={styles.modalRow}>
          <Field label="Valor (R$)">
            <Input
              type="text"
              inputMode="decimal"
              value={valorReais}
              onChange={(e) => setValorReais(e.target.value)}
              placeholder="0,00"
            />
          </Field>
          <Field label="Data esperada">
            <Input
              type="date"
              value={dataEsperada}
              onChange={(e) => setDataEsperada(e.target.value)}
            />
          </Field>
        </div>

        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={jaRecebido}
            onChange={(e) => setJaRecebido(e.target.checked)}
          />
          Já recebi
        </label>

        {jaRecebido && (
          <Field label="Data recebida">
            <Input
              type="date"
              value={dataRecebida}
              onChange={(e) => setDataRecebida(e.target.value)}
            />
          </Field>
        )}

        {erro && <p className={styles.erro}>{erro}</p>}

        <div className={styles.modalActions}>
          <Button variant="ghost" size="sm" onClick={onCancelar} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Salvando…' : 'Registrar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
