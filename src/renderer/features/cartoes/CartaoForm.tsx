import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Cartao } from '@domain/entities/cartao'
import { cartaoInputSchema, type CartaoInput } from '@shared/ipc/cartao'
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

      <div className={styles.field}>
        <label htmlFor="nome">Nome</label>
        <input id="nome" type="text" {...register('nome')} placeholder="Ex: Nubank" />
        {errors.nome && <span className={styles.fieldError}>{errors.nome.message}</span>}
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="diaFechamento">Dia fechamento</label>
          <input
            id="diaFechamento"
            type="number"
            min={1}
            max={31}
            {...register('diaFechamento', { valueAsNumber: true })}
          />
          {errors.diaFechamento && (
            <span className={styles.fieldError}>{errors.diaFechamento.message}</span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="diaVencimento">Dia vencimento</label>
          <input
            id="diaVencimento"
            type="number"
            min={1}
            max={31}
            {...register('diaVencimento', { valueAsNumber: true })}
          />
          {errors.diaVencimento && (
            <span className={styles.fieldError}>{errors.diaVencimento.message}</span>
          )}
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="cor">Cor</label>
        <div className={styles.colorRow}>
          <input id="cor" type="color" {...register('cor')} className={styles.colorInput} />
        </div>
        {errors.cor && <span className={styles.fieldError}>{errors.cor.message}</span>}
      </div>

      <div className={styles.formActions}>
        <button type="button" onClick={onCancelar} className={styles.btnSecondary}>
          Cancelar
        </button>
        <button type="submit" disabled={isSubmitting} className={styles.btnPrimary}>
          {isSubmitting ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
