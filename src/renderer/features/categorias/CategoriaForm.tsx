import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Categoria } from '@domain/entities/categoria'
import { categoriaInputSchema, type CategoriaInput } from '@shared/ipc/categoria'
import { Button, Field, Input } from '../../components/ui'
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
          cor: categoriaInicial.cor
        }
      : { tipo: 'Despesa', cor: '#000000' }
  })

  return (
    <form onSubmit={handleSubmit(onSalvar)} className={styles.form}>
      <h2 className={styles.formTitle}>
        {mode === 'criar' ? 'Nova categoria' : 'Editar categoria'}
      </h2>

      <Field label="Nome" error={errors.nome?.message} required>
        <Input type="text" {...register('nome')} placeholder="Ex: Mercado" error={!!errors.nome} />
      </Field>

      <Field label="Tipo" error={errors.tipo?.message} required>
        <div className={styles.radioGroup}>
          {(['Despesa', 'Renda', 'Ambos'] as const).map((tipo) => (
            <label key={tipo} className={styles.radioLabel}>
              <input type="radio" value={tipo} {...register('tipo')} />
              {tipo}
            </label>
          ))}
        </div>
      </Field>

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
