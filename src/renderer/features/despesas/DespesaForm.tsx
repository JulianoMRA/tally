import { useState } from 'react'
import {
  useForm,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegister
} from 'react-hook-form'
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
import type { PreenchimentoDespesa } from '../saidas/montar-preenchimento'
import { Button, Field, Input, Select } from '../../components/ui'
import { parseCentavos, valorTotalCentavosParcelada, type ModoValorParcela } from './parcela-valor'
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
  preenchimento?: PreenchimentoDespesa
  onSalvarUnica: (input: DespesaUnicaCreditoInput) => Promise<void>
  onSalvarUnicaForaCartao: (input: DespesaUnicaForaCartaoInput) => Promise<void>
  onSalvarParcelada: (input: DespesaParceladaCreditoInput) => Promise<void>
  onSalvarEmAndamento: (input: DespesaEmAndamentoInput) => Promise<void>
  onSalvarAssinatura: (input: DespesaAssinaturaCreditoInput) => Promise<void>
}

type FormaPagamento = 'Credito' | 'Pix' | 'Debito' | 'Dinheiro'

function CamposComuns<T extends FieldValues>({
  register,
  errors,
  cartoes,
  categorias,
  mostrarCartao = true
}: {
  register: UseFormRegister<T>
  errors: FieldErrors<T>
  cartoes: Cartao[]
  categorias: Categoria[]
  mostrarCartao?: boolean
}) {
  const descricao = 'descricao' as Path<T>
  const categoriaId = 'categoriaId' as Path<T>
  const cartaoId = 'cartaoId' as Path<T>
  const errDescricao = errors.descricao as { message?: string } | undefined
  const errCategoria = errors.categoriaId as { message?: string } | undefined
  const errCartao = errors.cartaoId as { message?: string } | undefined
  return (
    <>
      <Field label="Descrição" error={errDescricao?.message} required>
        <Input
          type="text"
          {...register(descricao)}
          placeholder="Ex: Notebook"
          error={!!errDescricao}
        />
      </Field>

      <div className={styles.fieldRow}>
        <Field label="Categoria" error={errCategoria?.message} required>
          <Select {...register(categoriaId, { valueAsNumber: true })} error={!!errCategoria}>
            <option value="">Selecione…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>

        {mostrarCartao && (
          <Field label="Cartão" error={errCartao?.message} required>
            <Select {...register(cartaoId, { valueAsNumber: true })} error={!!errCartao}>
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
  onSalvar,
  defaultValues
}: {
  cartoes: Cartao[]
  categorias: Categoria[]
  onSalvar: Props['onSalvarUnica']
  defaultValues?: Partial<UniqueValues>
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<UniqueValues>({ resolver: zodResolver(uniqueSchema), defaultValues })

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
  onSalvar,
  defaultValues
}: {
  categorias: Categoria[]
  formaPagamento: 'Pix' | 'Debito' | 'Dinheiro'
  onSalvar: Props['onSalvarUnicaForaCartao']
  defaultValues?: Partial<UnicaForaCartaoValues>
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<UnicaForaCartaoValues>({
    resolver: zodResolver(unicaForaCartaoSchema),
    // categoriaId fica undefined ate o usuario selecionar; zod cobra > 0 no submit
    defaultValues: {
      formaPagamento,
      descricao: '',
      valorReais: '',
      dataCompra: '',
      ...defaultValues
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
  onSalvarForaCartao,
  formaInicial = 'Credito',
  defaultsCredito,
  defaultsForaCartao
}: {
  cartoes: Cartao[]
  categorias: Categoria[]
  onSalvarCredito: Props['onSalvarUnica']
  onSalvarForaCartao: Props['onSalvarUnicaForaCartao']
  formaInicial?: FormaPagamento
  defaultsCredito?: Partial<UniqueValues>
  defaultsForaCartao?: Partial<UnicaForaCartaoValues>
}) {
  const [forma, setForma] = useState<FormaPagamento>(formaInicial)

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
        <FormUnicaCredito
          cartoes={cartoes}
          categorias={categorias}
          onSalvar={onSalvarCredito}
          defaultValues={defaultsCredito}
        />
      ) : (
        <FormUnicaForaCartao
          categorias={categorias}
          formaPagamento={forma}
          onSalvar={onSalvarForaCartao}
          defaultValues={defaultsForaCartao}
        />
      )}
    </div>
  )
}

function FormParcelada({
  cartoes,
  categorias,
  onSalvar,
  defaultValues
}: {
  cartoes: Cartao[]
  categorias: Categoria[]
  onSalvar: Props['onSalvarParcelada']
  defaultValues?: Partial<ParceladaValues>
}) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ParceladaValues>({ resolver: zodResolver(parceladaSchema), defaultValues })

  const [modoValor, setModoValor] = useState<ModoValorParcela>('total')
  const valorReais = watch('valorReais') ?? ''
  const totalParcelas = watch('totalParcelas')
  const valorNumerico = parseFloat(valorReais.replace(',', '.'))
  const previewValido =
    Number.isFinite(valorNumerico) &&
    typeof totalParcelas === 'number' &&
    Number.isInteger(totalParcelas) &&
    totalParcelas > 0
  const previewTexto = !previewValido
    ? null
    : modoValor === 'total'
      ? `≈ R$ ${(valorNumerico / totalParcelas).toFixed(2)} por parcela`
      : `= R$ ${(valorNumerico * totalParcelas).toFixed(2)} no total`

  async function onSubmit(values: ParceladaValues) {
    await onSalvar({
      descricao: values.descricao,
      categoriaId: Number(values.categoriaId),
      cartaoId: Number(values.cartaoId),
      totalParcelas: Number(values.totalParcelas),
      valorTotalCentavos: valorTotalCentavosParcelada(
        modoValor,
        values.valorReais,
        Number(values.totalParcelas)
      ),
      dataCompra: values.dataCompra
    })
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.formInner}>
      <CamposComuns register={register} errors={errors} cartoes={cartoes} categorias={categorias} />

      <div className={styles.formaSelector}>
        {(
          [
            { value: 'total', label: 'Valor total' },
            { value: 'parcela', label: 'Valor por parcela' }
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`${styles.formaBtn} ${modoValor === value ? styles.formaBtnActive : ''}`}
            onClick={() => setModoValor(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.fieldRow}>
        <Field
          label={modoValor === 'total' ? 'Valor total (R$)' : 'Valor por parcela (R$)'}
          error={errors.valorReais?.message}
          required
        >
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

      {previewTexto && <p className={styles.valorParcela}>{previewTexto}</p>}

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
    const total = Number(values.totalParcelas)
    const atual = Number(values.parcelaAtual)
    const parcelasRestantes = Math.max(1, total - atual + 1)
    const valorParcelaCentavos = parseCentavos(values.valorReais)
    await onSalvar({
      descricao: values.descricao,
      categoriaId: Number(values.categoriaId),
      cartaoId: Number(values.cartaoId),
      totalParcelas: total,
      parcelaAtual: atual,
      valorRestanteCentavos: valorParcelaCentavos * parcelasRestantes,
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
        <Field label="Valor da parcela (R$)" error={errors.valorReais?.message} required>
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
  onSalvar,
  defaultValues
}: {
  cartoes: Cartao[]
  categorias: Categoria[]
  onSalvar: Props['onSalvarAssinatura']
  defaultValues?: Partial<AssinaturaValues>
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<AssinaturaValues>({ resolver: zodResolver(assinaturaSchema), defaultValues })

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

function cartaoIdDefault(cartaoId: number | null): number | undefined {
  return cartaoId ?? undefined
}

export function DespesaForm({
  cartoes,
  categorias,
  preenchimento,
  onSalvarUnica,
  onSalvarUnicaForaCartao,
  onSalvarParcelada,
  onSalvarEmAndamento,
  onSalvarAssinatura
}: Props) {
  const [tipo, setTipo] = useState<TipoDespesa>(preenchimento?.tipo ?? 'unica')

  const tipoLabels: { value: TipoDespesa; label: string }[] = [
    { value: 'unica', label: 'Única' },
    { value: 'parcelada', label: 'Parcelada' },
    { value: 'em-andamento', label: 'Em andamento' },
    { value: 'assinatura', label: 'Assinatura' }
  ]

  const preUnica = preenchimento?.tipo === 'unica' ? preenchimento : undefined
  const preParcelada = preenchimento?.tipo === 'parcelada' ? preenchimento : undefined
  const preAssinatura = preenchimento?.tipo === 'assinatura' ? preenchimento : undefined

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
          formaInicial={preUnica?.forma ?? 'Credito'}
          defaultsCredito={
            preUnica && preUnica.forma === 'Credito'
              ? {
                  descricao: preUnica.descricao,
                  categoriaId: preUnica.categoriaId,
                  cartaoId: cartaoIdDefault(preUnica.cartaoId),
                  valorReais: preUnica.valorReais
                }
              : undefined
          }
          defaultsForaCartao={
            preUnica && preUnica.forma !== 'Credito'
              ? {
                  descricao: preUnica.descricao,
                  categoriaId: preUnica.categoriaId,
                  valorReais: preUnica.valorReais
                }
              : undefined
          }
        />
      )}
      {tipo === 'parcelada' && (
        <FormParcelada
          cartoes={cartoes}
          categorias={categorias}
          onSalvar={onSalvarParcelada}
          defaultValues={
            preParcelada
              ? {
                  descricao: preParcelada.descricao,
                  categoriaId: preParcelada.categoriaId,
                  cartaoId: cartaoIdDefault(preParcelada.cartaoId),
                  valorReais: preParcelada.valorReais,
                  totalParcelas: preParcelada.totalParcelas ?? undefined
                }
              : undefined
          }
        />
      )}
      {tipo === 'em-andamento' && (
        <FormEmAndamento cartoes={cartoes} categorias={categorias} onSalvar={onSalvarEmAndamento} />
      )}
      {tipo === 'assinatura' && (
        <FormAssinatura
          cartoes={cartoes}
          categorias={categorias}
          onSalvar={onSalvarAssinatura}
          defaultValues={
            preAssinatura
              ? {
                  descricao: preAssinatura.descricao,
                  categoriaId: preAssinatura.categoriaId,
                  cartaoId: cartaoIdDefault(preAssinatura.cartaoId),
                  valorReais: preAssinatura.valorReais
                }
              : undefined
          }
        />
      )}
    </div>
  )
}
