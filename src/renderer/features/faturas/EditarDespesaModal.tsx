import { useEffect, useState } from 'react'
import { categoriasParaEdicao, rotuloDeCategoria } from '../../lib/categorias'
import { centavosParaReais, ehValorValido, parseCentavos } from '../../lib/dinheiro'
import type { Categoria } from '@domain/entities/categoria'
import type { Despesa } from '@domain/entities/despesa'
import { Button, Field, Input, Modal, Select } from '../../components/ui'
import { mensagemErro } from '../../lib/mensagem-erro'
import styles from './faturas.module.css'

type Props = {
  despesa: Despesa
  /** Todas, inclusive as arquivadas: o modal decide o que oferecer. */
  categorias: Categoria[]
  /**
   * Motivo de valor e data não poderem mudar (RF-DES-10): compra à vista cuja
   * fatura não está Aberta. Com ele os dois campos ficam desabilitados e o
   * motivo aparece; sem ele, o modal deixava editar e a gravação era recusada.
   */
  travaValorEData?: string
  onConfirmar: (input: {
    descricao: string
    categoriaId: number
    valorCentavos: number
    dataCompra?: string
  }) => Promise<void>
  onCancelar: () => void
}

export function EditarDespesaModal({
  despesa,
  categorias,
  travaValorEData,
  onConfirmar,
  onCancelar
}: Props) {
  const [descricao, setDescricao] = useState(despesa.descricao)
  const [categoriaId, setCategoriaId] = useState(String(despesa.categoriaId))
  const [valorReais, setValorReais] = useState(centavosParaReais(despesa.valorCentavos))
  const [dataCompra, setDataCompra] = useState(despesa.dataCompra)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setDescricao(despesa.descricao)
    setCategoriaId(String(despesa.categoriaId))
    setValorReais(centavosParaReais(despesa.valorCentavos))
    setDataCompra(despesa.dataCompra)
  }, [despesa])

  const podeEditarData = despesa.tipo === 'Unica' && !travaValorEData

  async function handleConfirmar() {
    if (!descricao.trim()) {
      setErro('Descrição é obrigatória.')
      return
    }
    if (!ehValorValido(valorReais)) {
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
      setErro(mensagemErro(e, 'Erro ao salvar.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      titulo="Editar despesa"
      descricao={
        <>
          Tipo: <strong>{despesa.tipo}</strong>.{' '}
          {despesa.tipo === 'Parcelada'
            ? 'Mudar o valor recalcula as parcelas em faturas abertas; as demais ficam como estão.'
            : 'Edição direta.'}
        </>
      }
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
        />
      </Field>

      <Field label="Categoria">
        <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          {categoriasParaEdicao(categorias, despesa.categoriaId).map((c) => (
            <option key={c.id} value={c.id}>
              {rotuloDeCategoria(c)}
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
            disabled={Boolean(travaValorEData)}
            title={travaValorEData}
          />
        </Field>

        {podeEditarData ? (
          <Field label="Data da compra">
            <Input type="date" value={dataCompra} onChange={(e) => setDataCompra(e.target.value)} />
          </Field>
        ) : (
          <Field label="Data da compra">
            <Input
              type="date"
              value={dataCompra}
              disabled
              title={travaValorEData ?? 'Data não editável para Parcelada'}
            />
          </Field>
        )}
      </div>

      {travaValorEData && <p className={styles.dicaTrava}>{travaValorEData}</p>}

      {erro && <p className={styles.erroAcao}>{erro}</p>}
    </Modal>
  )
}
