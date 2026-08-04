import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  criarRendaAvulsaInputSchema,
  criarRendaRecorrenteInputSchema,
  type CriarRendaAvulsaInput,
  type CriarRendaRecorrenteInput
} from '@shared/ipc/renda'
import { Button, Field, Input, SegmentedControl, type OpcaoSegmentada } from '../../components/ui'
import styles from './rendas.module.css'

type TipoForm = 'recorrente' | 'avulsa'

const TIPOS_RENDA: readonly OpcaoSegmentada<TipoForm>[] = [
  { valor: 'recorrente', rotulo: 'Recorrente' },
  { valor: 'avulsa', rotulo: 'Avulsa' }
]

type AvulsaValues = Omit<CriarRendaAvulsaInput, 'valorPadraoCentavos'> & {
  valorReais: string
}
type RecorrenteValues = Omit<CriarRendaRecorrenteInput, 'valorPadraoCentavos'> & {
  valorReais: string
}

const avulsaSchema = criarRendaAvulsaInputSchema
  .omit({ valorPadraoCentavos: true })
  .extend({ valorReais: z.string().regex(/^\d+([.,]\d{1,2})?$/, 'Valor inválido') })

const recorrenteSchema = criarRendaRecorrenteInputSchema
  .omit({ valorPadraoCentavos: true })
  .extend({ valorReais: z.string().regex(/^\d+([.,]\d{1,2})?$/, 'Valor inválido') })

function parseCentavos(reais: string): number {
  return Math.round(parseFloat(reais.replace(',', '.')) * 100)
}

type Props = {
  onSalvarAvulsa: (input: CriarRendaAvulsaInput) => Promise<void>
  onSalvarRecorrente: (input: CriarRendaRecorrenteInput) => Promise<void>
}

function FormRecorrente({ onSalvar }: { onSalvar: Props['onSalvarRecorrente'] }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<RecorrenteValues>({ resolver: zodResolver(recorrenteSchema) })

  async function onSubmit(values: RecorrenteValues) {
    await onSalvar({
      nome: values.nome,
      valorPadraoCentavos: parseCentavos(values.valorReais),
      diaEsperado: Number(values.diaEsperado),
      dataInicio: values.dataInicio
    })
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Field label="Nome" error={errors.nome?.message} required>
        <Input
          type="text"
          {...register('nome')}
          placeholder="Ex: Bolsa PET"
          error={!!errors.nome}
        />
      </Field>

      <Field label="Valor padrão (R$)" error={errors.valorReais?.message} required>
        <Input
          type="text"
          inputMode="decimal"
          {...register('valorReais')}
          placeholder="0,00"
          error={!!errors.valorReais}
        />
      </Field>

      <div className={styles.fieldRow}>
        <Field label="Dia esperado" error={errors.diaEsperado?.message} required>
          <Input
            type="number"
            min={1}
            max={31}
            {...register('diaEsperado', { valueAsNumber: true })}
            placeholder="5"
            error={!!errors.diaEsperado}
          />
        </Field>
        <Field label="Data de início" error={errors.dataInicio?.message} required>
          <Input type="date" {...register('dataInicio')} error={!!errors.dataInicio} />
        </Field>
      </div>

      <p className={styles.empty}>
        Serão geradas 12 ocorrências esperadas a partir da data de início.
      </p>

      <div className={styles.formActions}>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Cadastrar renda'}
        </Button>
      </div>
    </form>
  )
}

function FormAvulsa({ onSalvar }: { onSalvar: Props['onSalvarAvulsa'] }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<AvulsaValues>({ resolver: zodResolver(avulsaSchema) })

  async function onSubmit(values: AvulsaValues) {
    await onSalvar({
      nome: values.nome,
      valorPadraoCentavos: parseCentavos(values.valorReais)
    })
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Field label="Nome" error={errors.nome?.message} required>
        <Input type="text" {...register('nome')} placeholder="Ex: Freela X" error={!!errors.nome} />
      </Field>

      <Field label="Valor padrão (R$)" error={errors.valorReais?.message} required>
        <Input
          type="text"
          inputMode="decimal"
          {...register('valorReais')}
          placeholder="0,00"
          error={!!errors.valorReais}
        />
      </Field>

      <p className={styles.empty}>Fonte avulsa não gera recebimentos automáticos.</p>

      <div className={styles.formActions}>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Cadastrar fonte'}
        </Button>
      </div>
    </form>
  )
}

export function RendaForm({ onSalvarAvulsa, onSalvarRecorrente }: Props) {
  const [tipo, setTipo] = useState<TipoForm>('recorrente')

  return (
    <div className={styles.form}>
      <h2 className={styles.formTitle}>Nova fonte de renda</h2>

      <SegmentedControl
        opcoes={TIPOS_RENDA}
        valor={tipo}
        onChange={setTipo}
        label="Tipo de fonte de renda"
        size="md"
      />

      {tipo === 'recorrente' ? (
        <FormRecorrente onSalvar={onSalvarRecorrente} />
      ) : (
        <FormAvulsa onSalvar={onSalvarAvulsa} />
      )}
    </div>
  )
}
