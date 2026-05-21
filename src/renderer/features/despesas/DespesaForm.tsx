import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  despesaUnicaCreditoInputSchema,
  despesaParceladaCreditoInputSchema,
  despesaEmAndamentoInputBaseSchema,
  despesaAssinaturaCreditoInputSchema,
  despesaUnicaForaCartaoInputSchema,
  parcelaAtualNaoExcedeTotal,
  type DespesaUnicaCreditoInput,
  type DespesaParceladaCreditoInput,
  type DespesaEmAndamentoInput,
  type DespesaAssinaturaCreditoInput,
  type DespesaUnicaForaCartaoInput
} from '@shared/ipc/despesa'
import type { Cartao } from '@domain/entities/cartao'
import type { Categoria } from '@domain/entities/categoria'
import { Button, Field, Input, Select } from '../../components/ui'
import styles from './despesas.module.css'

type TipoDespesa = 'unica' | 'parcelada' | 'em-andamento' | 'assinatura'

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

// ──── Assinatura ────────────────────────────────────────────────
type AssinaturaValues = Omit<DespesaAssinaturaCreditoInput, 'valorMensalCentavos'> & {
  valorReais: string
}

const assinaturaSchema = despesaAssinaturaCreditoInputSchema
  .omit({ valorMensalCentavos: true })
  .extend({ valorReais: z.string().regex(/^\d+([.,]\d{1,2})?$/, 'Valor inválido') })

// ──── Única fora de cartão ──────────────────────────────────────
type UnicaForaCartaoValues = Omit<DespesaUnicaForaCartaoInput, 'valorCentavos'> & {
  valorReais: string
}

const unicaForaCartaoSchema = despesaUnicaForaCartaoInputSchema
  .omit({ valorCentavos: true })
  .extend({ valorReais: z.string().regex(/^\d+([.,]\d{1,2})?$/, 'Valor inválido') })

type Props = {
  cartoes: Cartao[]
  categorias: Categoria[]
  onSalvarUnica: (input: DespesaUnicaCreditoInput) => Promise<void>
  onSalvarUnicaForaCartao: (input: DespesaUnicaForaCartaoInput) => Promise<void>
  onSalvarParcelada: (input: DespesaParceladaCreditoInput) => Promise<void>
  onSalvarEmAndamento: (input: DespesaEmAndamentoInput) => Promise<void>
  onSalvarAssinatura: (input: DespesaAssinaturaCreditoInput) => Promise<void>
}

type FormaPagamento = 'Credito' | 'Pix' | 'Debito' | 'Dinheiro'

function parseCentavos(reais: string): number {
  return Math.round(parseFloat(reais.replace(',', '.')) * 100)
}

function CamposComuns({
  register,
  errors,
  cartoes,
  categorias,
  mostrarCartao = true
}: {
  register: ReturnType<typeof useForm>['register']
  errors: Record<string, { message?: string } | undefined>
  cartoes: Cartao[]
  categorias: Categoria[]
  mostrarCartao?: boolean
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
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>

        {mostrarCartao && (
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
        )}
      </div>
    </>
  )
}

function FormUnicaCredito({
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

function FormUnicaForaCartao({
  categorias,
  formaPagamento,
  onSalvar
}: {
  categorias: Categoria[]
  formaPagamento: 'Pix' | 'Debito' | 'Dinheiro'
  onSalvar: Props['onSalvarUnicaForaCartao']
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<UnicaForaCartaoValues>({
    resolver: zodResolver(unicaForaCartaoSchema),
    values: {
      formaPagamento,
      descricao: '',
      categoriaId: 0 as unknown as number,
      valorReais: '',
      dataCompra: ''
    }
  })

  async function onSubmit(values: UnicaForaCartaoValues) {
    await onSalvar({
      descricao: values.descricao,
      categoriaId: Number(values.categoriaId),
      formaPagamento,
      valorCentavos: parseCentavos(values.valorReais),
      dataCompra: values.dataCompra
    })
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.formInner}>
      <CamposComuns
        register={register}
        errors={errors}
        cartoes={[]}
        categorias={categorias}
        mostrarCartao={false}
      />

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
          {isSubmitting ? 'Registrando…' : `Registrar ${formaPagamento.toLowerCase()}`}
        </Button>
      </div>
    </form>
  )
}

function FormUnica({
  cartoes,
  categorias,
  onSalvarCredito,
  onSalvarForaCartao
}: {
  cartoes: Cartao[]
  categorias: Categoria[]
  onSalvarCredito: Props['onSalvarUnica']
  onSalvarForaCartao: Props['onSalvarUnicaForaCartao']
}) {
  const [forma, setForma] = useState<FormaPagamento>('Credito')

  const formaLabels: { value: FormaPagamento; label: string }[] = [
    { value: 'Credito', label: 'Crédito' },
    { value: 'Pix', label: 'Pix' },
    { value: 'Debito', label: 'Débito' },
    { value: 'Dinheiro', label: 'Dinheiro' }
  ]

  return (
    <div className={styles.formInner}>
      <div className={styles.formaSelector}>
        {formaLabels.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`${styles.formaBtn} ${forma === value ? styles.formaBtnActive : ''}`}
            onClick={() => setForma(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {forma === 'Credito' ? (
        <FormUnicaCredito cartoes={cartoes} categorias={categorias} onSalvar={onSalvarCredito} />
      ) : (
        <FormUnicaForaCartao
          categorias={categorias}
          formaPagamento={forma}
          onSalvar={onSalvarForaCartao}
        />
      )}
    </div>
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

function FormAssinatura({
  cartoes,
  categorias,
  onSalvar
}: {
  cartoes: Cartao[]
  categorias: Categoria[]
  onSalvar: Props['onSalvarAssinatura']
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<AssinaturaValues>({ resolver: zodResolver(assinaturaSchema) })

  async function onSubmit(values: AssinaturaValues) {
    await onSalvar({
      descricao: values.descricao,
      categoriaId: Number(values.categoriaId),
      cartaoId: Number(values.cartaoId),
      valorMensalCentavos: parseCentavos(values.valorReais),
      dataInicio: values.dataInicio
    })
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.formInner}>
      <CamposComuns register={register} errors={errors} cartoes={cartoes} categorias={categorias} />

      <div className={styles.fieldRow}>
        <Field label="Valor mensal (R$)" error={errors.valorReais?.message} required>
          <Input
            type="text"
            inputMode="decimal"
            {...register('valorReais')}
            placeholder="0,00"
            error={!!errors.valorReais}
          />
        </Field>
        <Field label="Data de início" error={errors.dataInicio?.message} required>
          <Input type="date" {...register('dataInicio')} error={!!errors.dataInicio} />
        </Field>
      </div>

      <p className={styles.valorParcela}>
        Serão geradas 12 ocorrências a partir da data de início.
      </p>

      <div className={styles.formActions}>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Registrando…' : 'Registrar assinatura'}
        </Button>
      </div>
    </form>
  )
}

export function DespesaForm({
  cartoes,
  categorias,
  onSalvarUnica,
  onSalvarUnicaForaCartao,
  onSalvarParcelada,
  onSalvarEmAndamento,
  onSalvarAssinatura
}: Props) {
  const [tipo, setTipo] = useState<TipoDespesa>('unica')

  const tipoLabels: { value: TipoDespesa; label: string }[] = [
    { value: 'unica', label: 'Única' },
    { value: 'parcelada', label: 'Parcelada' },
    { value: 'em-andamento', label: 'Em andamento' },
    { value: 'assinatura', label: 'Assinatura' }
  ]

  return (
    <div className={styles.form}>
      <h2 className={styles.formTitle}>Nova despesa</h2>

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
        <FormUnica
          cartoes={cartoes}
          categorias={categorias}
          onSalvarCredito={onSalvarUnica}
          onSalvarForaCartao={onSalvarUnicaForaCartao}
        />
      )}
      {tipo === 'parcelada' && (
        <FormParcelada cartoes={cartoes} categorias={categorias} onSalvar={onSalvarParcelada} />
      )}
      {tipo === 'em-andamento' && (
        <FormEmAndamento cartoes={cartoes} categorias={categorias} onSalvar={onSalvarEmAndamento} />
      )}
      {tipo === 'assinatura' && (
        <FormAssinatura cartoes={cartoes} categorias={categorias} onSalvar={onSalvarAssinatura} />
      )}
    </div>
  )
}
