import { useState } from 'react'
import type { Categoria } from '@domain/entities/categoria'
import type { Despesa } from '@domain/entities/despesa'
import { Button, Field, Input, Modal, Select } from '../../components/ui'
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
    <Modal
      titulo="Editar assinatura"
      descricao="Mudar o valor mensal aplica o novo valor às ocorrências pendentes em faturas abertas; ocorrências fechadas ou pagas permanecem no histórico."
      onFechar={onCancelar}
      rodape={
        <>
          <Button variant="ghost" size="sm" onClick={onCancelar} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
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
    </Modal>
  )
}
