import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  despesaUnicaCreditoInputSchema,
  despesaParceladaCreditoInputSchema,
  despesaEmAndamentoInputBaseSchema,
  parcelaAtualNaoExcedeTotal,
  type DespesaUnicaCreditoInput,
  type DespesaParceladaCreditoInput,
  type DespesaEmAndamentoInput
} from '@shared/ipc/despesa'
import type { Cartao } from '@domain/entities/cartao'
import type { Categoria } from '@domain/entities/categoria'
import { Button, Field, Input, Select } from '../../components/ui'
import styles from './despesas.module.css'

type TipoDespesa = 'unica' | 'parcelada' | 'em-andamento'

// ──── Única ────────────────────────────────────────────────────
type UniqueValues = Omit<DespesaUnicaCreditoInput, 'valorCentavos'> & { valorReais: string }

const uniqueSchema = despesaUnicaCreditoInputSchema
  .omit({ valorCentavos: true })
  .extend({ valorReais: z.string().regex(/^\d+([.,]\d{1,2})?$/, 'Valor inválido') })

// ──── Parcelada ─────────────────────────────────────────────────
type ParceladaValues = Omit<DespesaParceladaCreditoInput, 'valorTotalCentavos'> & {
  valorReais: string
}

const parceladaSchema = despesaParceladaCreditoInputSchema
  .omit({ valorTotalCentavos: true })
  .extend({ valorReais: z.string().regex(/^\d+([.,]\d{1,2})?$/, 'Valor inválido') })

// ──── Em andamento ──────────────────────────────────────────────
type EmAndamentoValues = Omit<DespesaEmAndamentoInput, 'valorRestanteCentavos'> & {
  valorReais: string
}

const emAndamentoSchema = despesaEmAndamentoInputBaseSchema
  .omit({ valorRestanteCentavos: true })
  .extend({ valorReais: z.string().regex(/^\d+([.,]\d{1,2})?$/, 'Valor inválido') })
  .refine(parcelaAtualNaoExcedeTotal.predicate, parcelaAtualNaoExcedeTotal.params)

type Props = {
  cartoes: Cartao[]
  categorias: Categoria[]
  onSalvarUnica: (input: DespesaUnicaCreditoInput) => Promise<void>
  onSalvarParcelada: (input: DespesaParceladaCreditoInput) => Promise<void>
  onSalvarEmAndamento: (input: DespesaEmAndamentoInput) => Promise<void>
}

function parseCentavos(reais: string): number {
  return Math.round(parseFloat(reais.replace(',', '.')) * 100)
}

function CamposComuns({
  register,
  errors,
  cartoes,
  categorias
}: {
  register: ReturnType<typeof useForm>['register']
  errors: Record<string, { message?: string } | undefined>
  cartoes: Cartao[]
  categorias: Categoria[]
}) {
  return (
    <>
      <Field label="Descrição" error={errors.descricao?.message} required>
        <Input
          type="text"
          {...register('descricao')}
          placeholder="Ex: Notebook"
          error={!!errors.descricao}
        />
      </Field>

      <div className={styles.fieldRow}>
        <Field label="Categoria" error={errors.categoriaId?.message} required>
          <Select
            {...register('categoriaId', { valueAsNumber: true })}
            error={!!errors.categoriaId}
          >
            <option value="">Selecione…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icone ? `${c.icone} ` : ''}
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Cartão" error={errors.cartaoId?.message} required>
          <Select {...register('cartaoId', { valueAsNumber: true })} error={!!errors.cartaoId}>
            <option value="">Selecione…</option>
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </>
  )
}

function FormUnica({
  cartoes,
  categorias,
  onSalvar
}: {
  cartoes: Cartao[]
  categorias: Categoria[]
  onSalvar: Props['onSalvarUnica']
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<UniqueValues>({ resolver: zodResolver(uniqueSchema) })

  async function onSubmit(values: UniqueValues) {
    await onSalvar({
      descricao: values.descricao,
      categoriaId: Number(values.categoriaId),
      cartaoId: Number(values.cartaoId),
      valorCentavos: parseCentavos(values.valorReais),
      dataCompra: values.dataCompra
    })
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.formInner}>
      <CamposComuns register={register} errors={errors} cartoes={cartoes} categorias={categorias} />

      <div className={styles.fieldRow}>
        <Field label="Valor (R$)" error={errors.valorReais?.message} required>
          <Input
            type="text"
            inputMode="decimal"
            {...register('valorReais')}
            placeholder="0,00"
            error={!!errors.valorReais}
          />
        </Field>
        <Field label="Data da compra" error={errors.dataCompra?.message} required>
          <Input type="date" {...register('dataCompra')} error={!!errors.dataCompra} />
        </Field>
      </div>

      <div className={styles.formActions}>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Registrando…' : 'Registrar despesa'}
        </Button>
      </div>
    </form>
  )
}

function FormParcelada({
  cartoes,
  categorias,
  onSalvar
}: {
  cartoes: Cartao[]
  categorias: Categoria[]
  onSalvar: Props['onSalvarParcelada']
}) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ParceladaValues>({ resolver: zodResolver(parceladaSchema) })

  const valorReais = watch('valorReais') ?? ''
  const totalParcelas = watch('totalParcelas') ?? 1
  const valorParcela =
    valorReais && !isNaN(parseFloat(valorReais.replace(',', '.')))
      ? (parseFloat(valorReais.replace(',', '.')) / Number(totalParcelas)).toFixed(2)
      : null

  async function onSubmit(values: ParceladaValues) {
    await onSalvar({
      descricao: values.descricao,
      categoriaId: Number(values.categoriaId),
      cartaoId: Number(values.cartaoId),
      totalParcelas: Number(values.totalParcelas),
      valorTotalCentavos: parseCentavos(values.valorReais),
      dataCompra: values.dataCompra
    })
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.formInner}>
      <CamposComuns register={register} errors={errors} cartoes={cartoes} categorias={categorias} />

      <div className={styles.fieldRow}>
        <Field label="Valor total (R$)" error={errors.valorReais?.message} required>
          <Input
            type="text"
            inputMode="decimal"
            {...register('valorReais')}
            placeholder="0,00"
            error={!!errors.valorReais}
          />
        </Field>
        <Field label="Total de parcelas" error={errors.totalParcelas?.message} required>
          <Input
            type="number"
            min={2}
            max={360}
            {...register('totalParcelas', { valueAsNumber: true })}
            placeholder="12"
            error={!!errors.totalParcelas}
          />
        </Field>
      </div>

      {valorParcela && <p className={styles.valorParcela}>≈ R$ {valorParcela} por parcela</p>}

      <Field label="Data da compra" error={errors.dataCompra?.message} required>
        <Input type="date" {...register('dataCompra')} error={!!errors.dataCompra} />
      </Field>

      <div className={styles.formActions}>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Registrando…' : 'Registrar parcelada'}
        </Button>
      </div>
    </form>
  )
}

function FormEmAndamento({
  cartoes,
  categorias,
  onSalvar
}: {
  cartoes: Cartao[]
  categorias: Categoria[]
  onSalvar: Props['onSalvarEmAndamento']
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<EmAndamentoValues>({ resolver: zodResolver(emAndamentoSchema) })

  async function onSubmit(values: EmAndamentoValues) {
    await onSalvar({
      descricao: values.descricao,
      categoriaId: Number(values.categoriaId),
      cartaoId: Number(values.cartaoId),
      totalParcelas: Number(values.totalParcelas),
      parcelaAtual: Number(values.parcelaAtual),
      valorRestanteCentavos: parseCentavos(values.valorReais),
      dataCompra: values.dataCompra
    })
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.formInner}>
      <CamposComuns register={register} errors={errors} cartoes={cartoes} categorias={categorias} />

      <div className={styles.fieldRow}>
        <Field label="Parcela atual" error={errors.parcelaAtual?.message} required>
          <Input
            type="number"
            min={1}
            {...register('parcelaAtual', { valueAsNumber: true })}
            placeholder="7"
            error={!!errors.parcelaAtual}
          />
        </Field>
        <Field label="Total de parcelas" error={errors.totalParcelas?.message} required>
          <Input
            type="number"
            min={2}
            max={360}
            {...register('totalParcelas', { valueAsNumber: true })}
            placeholder="12"
            error={!!errors.totalParcelas}
          />
        </Field>
      </div>

      <div className={styles.fieldRow}>
        <Field label="Valor restante (R$)" error={errors.valorReais?.message} required>
          <Input
            type="text"
            inputMode="decimal"
            {...register('valorReais')}
            placeholder="0,00"
            error={!!errors.valorReais}
          />
        </Field>
        <Field label="Data da 1ª parcela restante" error={errors.dataCompra?.message} required>
          <Input type="date" {...register('dataCompra')} error={!!errors.dataCompra} />
        </Field>
      </div>

      <div className={styles.formActions}>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Registrando…' : 'Registrar em andamento'}
        </Button>
      </div>
    </form>
  )
}

export function DespesaForm({
  cartoes,
  categorias,
  onSalvarUnica,
  onSalvarParcelada,
  onSalvarEmAndamento
}: Props) {
  const [tipo, setTipo] = useState<TipoDespesa>('unica')

  const tipoLabels: { value: TipoDespesa; label: string }[] = [
    { value: 'unica', label: 'Única' },
    { value: 'parcelada', label: 'Parcelada' },
    { value: 'em-andamento', label: 'Em andamento' }
  ]

  return (
    <div className={styles.form}>
      <h2 className={styles.formTitle}>Nova despesa · crédito</h2>

      <div className={styles.tipoSelector}>
        {tipoLabels.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`${styles.tipoBtn} ${tipo === value ? styles.tipoBtnActive : ''}`}
            onClick={() => setTipo(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {tipo === 'unica' && (
        <FormUnica cartoes={cartoes} categorias={categorias} onSalvar={onSalvarUnica} />
      )}
      {tipo === 'parcelada' && (
        <FormParcelada cartoes={cartoes} categorias={categorias} onSalvar={onSalvarParcelada} />
      )}
      {tipo === 'em-andamento' && (
        <FormEmAndamento cartoes={cartoes} categorias={categorias} onSalvar={onSalvarEmAndamento} />
      )}
    </div>
  )
}
