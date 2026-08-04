import { useState } from 'react'
import type { Categoria } from '@domain/entities/categoria'
import type { Despesa } from '@domain/entities/despesa'
import { Button, Field, Input, Select } from '../../components/ui'
import { useEscapeKey } from '../../hooks/use-escape-key'
import { useFocusTrap } from '../../hooks/use-focus-trap'
import { parseCentavos } from '../despesas/parcela-valor'
import styles from './assinaturas.module.css'

type Props = {
  assinatura: Despesa
  categorias: Categoria[]
  onConfirmar: (input: {
    descricao: string
    categoriaId: number
    valorCentavos: number
  }) => Promise<void>
  onCancelar: () => void
}

export function EditarAssinaturaModal({ assinatura, categorias, onConfirmar, onCancelar }: Props) {
  const [descricao, setDescricao] = useState(assinatura.descricao)
  const [categoriaId, setCategoriaId] = useState(String(assinatura.categoriaId))
  const [valorReais, setValorReais] = useState(
    (assinatura.valorCentavos / 100).toFixed(2).replace('.', ',')
  )
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const modalRef = useFocusTrap<HTMLDivElement>()
  useEscapeKey(onCancelar)

  async function handleConfirmar() {
    if (!descricao.trim()) {
      setErro('Descrição é obrigatória.')
      return
    }
    if (!/^\d+([.,]\d{1,2})?$/.test(valorReais)) {
      setErro('Valor inválido.')
      return
    }
    const valorCentavos = parseCentavos(valorReais)
    if (valorCentavos <= 0) {
      setErro('Valor deve ser maior que zero.')
      return
    }
    setErro(null)
    setLoading(true)
    try {
      await onConfirmar({
        descricao: descricao.trim(),
        categoriaId: Number(categoriaId),
        valorCentavos
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.modalOverlay}>
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Editar assinatura"
      >
        <h3 className={styles.modalTitle}>Editar assinatura</h3>
        <p className={styles.modalDesc}>
          Mudar o valor mensal aplica o novo valor às ocorrências pendentes em faturas abertas;
          ocorrências fechadas ou pagas permanecem no histórico.
        </p>

        <Field label="Descrição">
          <Input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={80}
            autoFocus
          />
        </Field>

        <Field label="Categoria">
          <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Valor mensal (R$)">
          <Input
            type="text"
            inputMode="decimal"
            value={valorReais}
            onChange={(e) => setValorReais(e.target.value)}
          />
        </Field>

        {erro && <p className={styles.erro}>{erro}</p>}

        <div className={styles.modalActions}>
          <Button variant="ghost" size="sm" onClick={onCancelar} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
