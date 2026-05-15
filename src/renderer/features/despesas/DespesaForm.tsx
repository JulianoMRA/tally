import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { despesaUnicaCreditoInputSchema, type DespesaUnicaCreditoInput } from '@shared/ipc/despesa'
import type { Cartao } from '@domain/entities/cartao'
import type { Categoria } from '@domain/entities/categoria'
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
      <h2 className={styles.formTitle}>Nova despesa (crédito)</h2>

      <div className={styles.field}>
        <label htmlFor="descricao">Descrição</label>
        <input
          id="descricao"
          type="text"
          {...register('descricao')}
          placeholder="Ex: Supermercado"
        />
        {errors.descricao && <span className={styles.fieldError}>{errors.descricao.message}</span>}
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="categoriaId">Categoria</label>
          <select id="categoriaId" {...register('categoriaId', { valueAsNumber: true })}>
            <option value="">Selecione…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icone ? `${c.icone} ` : ''}
                {c.nome}
              </option>
            ))}
          </select>
          {errors.categoriaId && (
            <span className={styles.fieldError}>{errors.categoriaId.message}</span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="cartaoId">Cartão</label>
          <select id="cartaoId" {...register('cartaoId', { valueAsNumber: true })}>
            <option value="">Selecione…</option>
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          {errors.cartaoId && <span className={styles.fieldError}>{errors.cartaoId.message}</span>}
        </div>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="valorReais">Valor (R$)</label>
          <input
            id="valorReais"
            type="text"
            inputMode="decimal"
            {...register('valorReais')}
            placeholder="0,00"
          />
          {errors.valorReais && (
            <span className={styles.fieldError}>{errors.valorReais.message}</span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="dataCompra">Data da compra</label>
          <input id="dataCompra" type="date" {...register('dataCompra')} />
          {errors.dataCompra && (
            <span className={styles.fieldError}>{errors.dataCompra.message}</span>
          )}
        </div>
      </div>

      <div className={styles.formActions}>
        <button type="submit" disabled={isSubmitting} className={styles.btnPrimary}>
          {isSubmitting ? 'Registrando…' : 'Registrar despesa'}
        </button>
      </div>
    </form>
  )
}
