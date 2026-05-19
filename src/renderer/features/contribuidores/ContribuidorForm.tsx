import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Contribuidor } from '@domain/entities/contribuidor'
import { contribuidorInputSchema, type ContribuidorInput } from '@shared/ipc/contribuidor'
import { Button, Field, Input } from '../../components/ui'
import styles from './contribuidores.module.css'

type Props = {
  mode: 'criar' | 'editar'
  contribuidorInicial?: Contribuidor
  onSalvar: (input: ContribuidorInput) => Promise<void>
  onCancelar: () => void
}

export function ContribuidorForm({ mode, contribuidorInicial, onSalvar, onCancelar }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ContribuidorInput>({
    resolver: zodResolver(contribuidorInputSchema),
    defaultValues: contribuidorInicial
      ? { nome: contribuidorInicial.nome, contato: contribuidorInicial.contato }
      : { contato: null }
  })

  return (
    <form onSubmit={handleSubmit(onSalvar)} className={styles.form}>
      <h2 className={styles.formTitle}>
        {mode === 'criar' ? 'Novo contribuidor' : 'Editar contribuidor'}
      </h2>

      <Field label="Nome" error={errors.nome?.message} required>
        <Input type="text" {...register('nome')} placeholder="Ex: Mãe" error={!!errors.nome} />
      </Field>

      <Field
        label="Contato"
        error={errors.contato?.message}
        hint="E-mail, telefone ou anotação (opcional)"
      >
        <Input
          type="text"
          {...register('contato')}
          placeholder="Ex: mae@exemplo.com"
          error={!!errors.contato}
        />
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
