import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Cartao } from '@domain/entities/cartao'
import { cartaoInputSchema, type CartaoInput } from '@shared/ipc/cartao'
import { Button, Field, Input } from '../../components/ui'
import styles from './cartoes.module.css'

type Props = {
  mode: 'criar' | 'editar'
  cartaoInicial?: Cartao
  onSalvar: (input: CartaoInput) => Promise<void>
  onCancelar: () => void
}

export function CartaoForm({ mode, cartaoInicial, onSalvar, onCancelar }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<CartaoInput>({
    resolver: zodResolver(cartaoInputSchema),
    defaultValues: cartaoInicial
      ? {
          nome: cartaoInicial.nome,
          diaFechamento: cartaoInicial.diaFechamento,
          diaVencimento: cartaoInicial.diaVencimento,
          cor: cartaoInicial.cor
        }
      : { cor: '#000000' }
  })

  return (
    <form onSubmit={handleSubmit(onSalvar)} className={styles.form}>
      <h2 className={styles.formTitle}>{mode === 'criar' ? 'Novo cartão' : 'Editar cartão'}</h2>

      <Field label="Nome" error={errors.nome?.message} required>
        <Input type="text" {...register('nome')} placeholder="Ex: Nubank" error={!!errors.nome} />
      </Field>

      <div className={styles.fieldRow}>
        <Field label="Dia de fechamento" error={errors.diaFechamento?.message} required>
          <Input
            type="number"
            min={1}
            max={31}
            {...register('diaFechamento', { valueAsNumber: true })}
            error={!!errors.diaFechamento}
          />
        </Field>
        <Field label="Dia de vencimento" error={errors.diaVencimento?.message} required>
          <Input
            type="number"
            min={1}
            max={31}
            {...register('diaVencimento', { valueAsNumber: true })}
            error={!!errors.diaVencimento}
          />
        </Field>
      </div>

      <Field label="Cor" error={errors.cor?.message}>
        <input type="color" {...register('cor')} className={styles.colorInput} />
      </Field>

      <div className={styles.formActions}>
        <Button type="button" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
