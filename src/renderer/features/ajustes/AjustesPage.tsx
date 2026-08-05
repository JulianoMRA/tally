import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { configSchema, type Config, type CopiaDeBackupDTO } from '@shared/ipc/config'
import { PageContainer } from '../../components/layout/PageContainer'
import { PageHead } from '../../components/layout/PageHead'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Panel,
  useToast
} from '../../components/ui'
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

  const [copias, setCopias] = useState<CopiaDeBackupDTO[]>([])
  const [alvoRestaurar, setAlvoRestaurar] = useState<CopiaDeBackupDTO | null>(null)

  const carregarCopias = useCallback(() => {
    window.api.config.listarBackups().then(setCopias)
  }, [])

  useEffect(carregarCopias, [carregarCopias])

  async function criarAgora() {
    try {
      setCopias(await window.api.config.criarBackupAgora())
      toast.show('Cópia criada.', 'success')
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao criar a cópia.'), 'error')
    }
  }

  async function abrirPasta() {
    await window.api.config.abrirPastaBackups()
  }

  async function confirmarRestaurar() {
    if (!alvoRestaurar) return
    try {
      // A janela recarrega no fim: o main faz isso depois de reabrir o banco.
      await window.api.config.restaurarBackup({ caminho: alvoRestaurar.caminho })
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao restaurar a cópia.'), 'error')
    } finally {
      setAlvoRestaurar(null)
    }
  }

  async function escolherPasta() {
    const pasta = await window.api.config.escolherPastaBackup()
    if (pasta) {
      setValue('backupsDir', pasta, { shouldDirty: true })
    }
  }

  return (
    <PageContainer width="narrow">
      <PageHead
        title="Ajustes"
        subtitle="Backups automáticos e avisos de fatura. As mudanças valem a partir do próximo evento (boot, saída ou checagem de avisos)."
      />
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

        <Panel
          title="Cópias de segurança"
          meta={`${copias.length} ${copias.length === 1 ? 'cópia' : 'cópias'}`}
          actions={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={abrirPasta}>
                Abrir pasta
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={criarAgora}>
                Fazer cópia agora
              </Button>
            </>
          }
        >
          {/* O app já criava cópias no boot e na saída, mas não havia como
              vê-las nem restaurá-las pela interface — só mexendo em arquivo. */}
          {copias.length === 0 ? (
            <EmptyState
              title="Nenhuma cópia ainda."
              description="Uma cópia é criada no boot do app e, se ativado acima, ao sair."
            />
          ) : (
            <ul className={styles.copias}>
              {copias.map((c) => (
                <li key={c.caminho} className={styles.copia}>
                  <div>
                    <span className={styles.copiaData}>{formatarDataHora(c.criadoEm)}</span>
                    <span className={styles.copiaTamanho}>{formatarTamanho(c.tamanhoBytes)}</span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setAlvoRestaurar(c)}
                  >
                    Restaurar
                  </Button>
                </li>
              ))}
            </ul>
          )}
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

      {alvoRestaurar && (
        <ConfirmDialog
          title="Restaurar esta cópia?"
          body={`Os dados atuais serão substituídos pelos de ${formatarDataHora(alvoRestaurar.criadoEm)}. Uma cópia do estado atual é criada antes, então dá para voltar.`}
          confirmText="Restaurar"
          confirmVariant="danger"
          onConfirm={confirmarRestaurar}
          onCancel={() => setAlvoRestaurar(null)}
        />
      )}
    </PageContainer>
  )
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR')
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}
