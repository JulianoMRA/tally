import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Categoria } from '@domain/entities/categoria'
import { categoriaInputSchema, type CategoriaInput } from '@shared/ipc/categoria'
import styles from './categorias.module.css'

type Props = {
  mode: 'criar' | 'editar'
  categoriaInicial?: Categoria
  onSalvar: (input: CategoriaInput) => Promise<void>
  onCancelar: () => void
}

export function CategoriaForm({ mode, categoriaInicial, onSalvar, onCancelar }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<CategoriaInput>({
    resolver: zodResolver(categoriaInputSchema),
    defaultValues: categoriaInicial
      ? {
          nome: categoriaInicial.nome,
          tipo: categoriaInicial.tipo,
          cor: categoriaInicial.cor,
          icone: categoriaInicial.icone
        }
      : { tipo: 'Despesa', cor: '#000000', icone: null }
  })

  return (
    <form onSubmit={handleSubmit(onSalvar)} className={styles.form}>
      <h2 className={styles.formTitle}>
        {mode === 'criar' ? 'Nova categoria' : 'Editar categoria'}
      </h2>

      <div className={styles.field}>
        <label htmlFor="nome">Nome</label>
        <input id="nome" type="text" {...register('nome')} placeholder="Ex: Mercado" />
        {errors.nome && <span className={styles.fieldError}>{errors.nome.message}</span>}
      </div>

      <div className={styles.field}>
        <label>Tipo</label>
        <div className={styles.radioGroup}>
          {(['Despesa', 'Renda', 'Ambos'] as const).map((tipo) => (
            <label key={tipo} className={styles.radioLabel}>
              <input type="radio" value={tipo} {...register('tipo')} />
              {tipo}
            </label>
          ))}
        </div>
        {errors.tipo && <span className={styles.fieldError}>{errors.tipo.message}</span>}
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="cor">Cor</label>
          <div className={styles.colorRow}>
            <input id="cor" type="color" {...register('cor')} className={styles.colorInput} />
          </div>
          {errors.cor && <span className={styles.fieldError}>{errors.cor.message}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="icone">Ícone (opcional)</label>
          <input
            id="icone"
            type="text"
            {...register('icone')}
            placeholder="🛒 ou Mercado"
            maxLength={16}
          />
          {errors.icone && <span className={styles.fieldError}>{errors.icone.message}</span>}
        </div>
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
