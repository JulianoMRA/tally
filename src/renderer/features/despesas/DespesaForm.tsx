import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { despesaUnicaCreditoInputSchema, type DespesaUnicaCreditoInput } from '@shared/ipc/despesa'
import type { Cartao } from '@domain/entities/cartao'
import type { Categoria } from '@domain/entities/categoria'
import { Button, Field, Input, Select } from '../../components/ui'
import styles from './despesas.module.css'

type FormValues = Omit<DespesaUnicaCreditoInput, 'valorCentavos'> & { valorReais: string }

const formSchema = despesaUnicaCreditoInputSchema
  .omit({ valorCentavos: true })
  .extend({ valorReais: z.string().regex(/^\d+([.,]\d{1,2})?$/, 'Valor inválido') })

type Props = {
  cartoes: Cartao[]
  categorias: Categoria[]
  onSalvar: (input: DespesaUnicaCreditoInput) => Promise<void>
}

export function DespesaForm({ cartoes, categorias, onSalvar }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      descricao: '',
      valorReais: '',
      dataCompra: new Date().toISOString().slice(0, 10)
    }
  })

  async function onSubmit(values: FormValues) {
    const valorCentavos = Math.round(parseFloat(values.valorReais.replace(',', '.')) * 100)
    await onSalvar({
      descricao: values.descricao,
      categoriaId: Number(values.categoriaId),
      cartaoId: Number(values.cartaoId),
      valorCentavos,
      dataCompra: values.dataCompra
    })
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <h2 className={styles.formTitle}>Despesa única · crédito</h2>

      <Field label="Descrição" error={errors.descricao?.message} required>
        <Input
          type="text"
          {...register('descricao')}
          placeholder="Ex: Supermercado"
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
