import { useEffect, useState } from 'react'
import type { Categoria } from '@domain/entities/categoria'
import type { Despesa } from '@domain/entities/despesa'
import { Button, Field, Input, Select } from '../../components/ui'
import { useEscapeKey } from '../../hooks/use-escape-key'
import { useFocusTrap } from '../../hooks/use-focus-trap'
import styles from './faturas.module.css'

type Props = {
  despesa: Despesa
  categorias: Categoria[]
  onConfirmar: (input: {
    descricao: string
    categoriaId: number
    valorCentavos: number
    dataCompra?: string
  }) => Promise<void>
  onCancelar: () => void
}

function centavosParaReais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',')
}

function parseCentavos(reais: string): number {
  return Math.round(parseFloat(reais.replace(',', '.')) * 100)
}

export function EditarDespesaModal({ despesa, categorias, onConfirmar, onCancelar }: Props) {
  const [descricao, setDescricao] = useState(despesa.descricao)
  const [categoriaId, setCategoriaId] = useState(String(despesa.categoriaId))
  const [valorReais, setValorReais] = useState(centavosParaReais(despesa.valorCentavos))
  const [dataCompra, setDataCompra] = useState(despesa.dataCompra)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const modalRef = useFocusTrap<HTMLDivElement>()
  useEscapeKey(onCancelar)

  useEffect(() => {
    setDescricao(despesa.descricao)
    setCategoriaId(String(despesa.categoriaId))
    setValorReais(centavosParaReais(despesa.valorCentavos))
    setDataCompra(despesa.dataCompra)
  }, [despesa])

  const podeEditarData = despesa.tipo === 'Unica'

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
        valorCentavos,
        dataCompra: podeEditarData ? dataCompra : undefined
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
        aria-label="Editar despesa"
      >
        <h3 className={styles.modalTitle}>Editar despesa</h3>
        <p className={styles.modalDesc}>
          Tipo: <strong>{despesa.tipo}</strong>.{' '}
          {despesa.tipo === 'Parcelada'
            ? 'Mudar o valor recalcula as parcelas pendentes (paga preserva).'
            : 'Edição direta.'}
        </p>

        <Field label="Descrição">
          <Input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={80}
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

        <div className={styles.modalFields}>
          <Field label={despesa.tipo === 'Parcelada' ? 'Valor total (R$)' : 'Valor (R$)'}>
            <Input
              type="text"
              inputMode="decimal"
              value={valorReais}
              onChange={(e) => setValorReais(e.target.value)}
            />
          </Field>

          {podeEditarData ? (
            <Field label="Data da compra">
              <Input
                type="date"
                value={dataCompra}
                onChange={(e) => setDataCompra(e.target.value)}
              />
            </Field>
          ) : (
            <Field label="Data da compra">
              <Input
                type="date"
                value={dataCompra}
                disabled
                title="Data não editável para Parcelada"
              />
            </Field>
          )}
        </div>

        {erro && <p className={styles.erroAcao}>{erro}</p>}

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
