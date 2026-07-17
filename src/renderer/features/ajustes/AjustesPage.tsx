import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { configSchema, type Config } from '@shared/ipc/config'
import { PageHead } from '../../components/layout/PageHead'
import { Button, Field, Input, Panel, useToast } from '../../components/ui'
import { mensagemErro } from '../../lib/mensagem-erro'
import styles from './ajustes.module.css'

export default function AjustesPage() {
  const toast = useToast()
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isLoading }
  } = useForm<Config>({
    resolver: zodResolver(configSchema),
    defaultValues: () => window.api.config.get()
  })

  const backupsDir = watch('backupsDir')

  useEffect(() => {
    // defaultValues assíncrono já popula o form; nada a fazer aqui além de
    // deixar o React re-renderizar quando o load terminar.
  }, [isLoading])

  async function onSubmit(config: Config) {
    try {
      const salva = await window.api.config.set(config)
      reset(salva)
      toast.show('Ajustes salvos.', 'success')
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao salvar os ajustes.'), 'error')
    }
  }

  async function escolherPasta() {
    const pasta = await window.api.config.escolherPastaBackup()
    if (pasta) {
      setValue('backupsDir', pasta, { shouldDirty: true })
    }
  }

  return (
    <>
      <PageHead
        title="Ajustes"
        subtitle="Backups automáticos e avisos de fatura. As mudanças valem a partir do próximo evento (boot, saída ou checagem de avisos)."
      />
      <div className={styles.body}>
        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <Panel title="Backups">
            <div className={styles.campos}>
              <Field label="Pasta de destino">
                <div className={styles.pastaRow}>
                  <Input
                    value={backupsDir ?? 'Padrão (pasta de dados do app)'}
                    readOnly
                    aria-label="Pasta de backups"
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={escolherPasta}>
                    Escolher pasta…
                  </Button>
                  {backupsDir !== null && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setValue('backupsDir', null, { shouldDirty: true })}
                    >
                      Usar padrão
                    </Button>
                  )}
                </div>
              </Field>

              <label className={styles.checkboxRow}>
                <input type="checkbox" {...register('backupAoSair')} />
                Fazer backup ao sair do app
              </label>

              <Field label="Quantidade de backups mantidos" error={errors.retencaoBackups?.message}>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  error={!!errors.retencaoBackups}
                  {...register('retencaoBackups', { valueAsNumber: true })}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Avisos de fatura">
            <div className={styles.campos}>
              <label className={styles.checkboxRow}>
                <input type="checkbox" {...register('notificacoesAtivas')} />
                Notificar fechamento e vencimento de faturas
              </label>

              <Field
                label="Dias de antecedência do aviso"
                error={errors.diasAntecedenciaAviso?.message}
              >
                <Input
                  type="number"
                  min={0}
                  max={15}
                  error={!!errors.diasAntecedenciaAviso}
                  {...register('diasAntecedenciaAviso', { valueAsNumber: true })}
                />
              </Field>
            </div>
          </Panel>

          <div className={styles.acoes}>
            <Button type="submit" variant="primary" disabled={isSubmitting || isLoading}>
              {isSubmitting ? 'Salvando…' : 'Salvar ajustes'}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
