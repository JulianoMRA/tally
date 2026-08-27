import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { criarRendaRecorrenteInputSchema, type CriarRendaRecorrenteInput } from '@shared/ipc/renda'
import { Button, Field, Input } from '../../components/ui'
import styles from './rendas.module.css'

type RecorrenteValues = Omit<CriarRendaRecorrenteInput, 'valorPadraoCentavos'> & {
  valorReais: string
}

const recorrenteSchema = criarRendaRecorrenteInputSchema
  .omit({ valorPadraoCentavos: true })
  .extend({ valorReais: z.string().regex(/^\d+([.,]\d{1,2})?$/, 'Valor inválido') })

function parseCentavos(reais: string): number {
  return Math.round(parseFloat(reais.replace(',', '.')) * 100)
}

type Props = {
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

/**
 * Cadastro de fonte de renda.
 *
 * Havia um SegmentedControl escolhendo entre Recorrente e Avulsa. Fonte avulsa
 * deixou de existir na migration 0011 — entrada avulsa vive sozinha, na aba
 * Recebimentos —, e com uma opcao so o seletor era cromo sem escolha. O
 * "valor padrao" que ele pedia para a avulsa nao alimentava calculo nenhum:
 * so era ecoado na lista, congelado no valor do primeiro recebimento.
 */
export function RendaForm({ onSalvarRecorrente }: Props) {
  return (
    <div className={styles.form}>
      <h2 className={styles.formTitle}>Nova fonte recorrente</h2>
      <FormRecorrente onSalvar={onSalvarRecorrente} />
    </div>
  )
}
