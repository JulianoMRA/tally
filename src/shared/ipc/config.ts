import { z } from 'zod'
import { CONFIG_IPC_CHANNELS } from './channels'

// Configuracao do app persistida em <userData>/settings.json (fora do SQLite:
// nao consome numero de migration nem entra no export/import de dados).

export const configSchema = z.object({
  /** Pasta destino dos backups; null usa o padrao (<userData>/backups). */
  backupsDir: z.string().min(1).nullable(),
  backupAoSair: z.boolean(),
  retencaoBackups: z.number().int().min(1).max(100),
  notificacoesAtivas: z.boolean(),
  diasAntecedenciaAviso: z.number().int().min(0).max(15)
})

export type Config = z.infer<typeof configSchema>

export const CONFIG_DEFAULTS: Config = {
  backupsDir: null,
  backupAoSair: true,
  retencaoBackups: 10,
  notificacoesAtivas: true,
  diasAntecedenciaAviso: 3
}

/**
 * Arquivo antigo (campos ausentes) preenche com defaults; campos presentes
 * com tipo errado invalidam o arquivo inteiro (caller decide o fallback).
 */
export const configArquivoSchema = configSchema.partial().transform((parcial) => ({
  ...CONFIG_DEFAULTS,
  ...Object.fromEntries(Object.entries(parcial).filter(([, v]) => v !== undefined))
}))

export const restaurarBackupInputSchema = z.object({
  caminho: z.string().min(1, 'Caminho do backup é obrigatório')
})

export type RestaurarBackupInput = z.infer<typeof restaurarBackupInputSchema>

export type CopiaDeBackupDTO = {
  caminho: string
  criadoEm: string
  tamanhoBytes: number
}

export type ConfigApi = {
  get: () => Promise<Config>
  set: (config: Config) => Promise<Config>
  escolherPastaBackup: () => Promise<string | null>
  listarBackups: () => Promise<CopiaDeBackupDTO[]>
  /** Cópia sob demanda, para antes de uma operação arriscada. */
  criarBackupAgora: () => Promise<CopiaDeBackupDTO[]>
  /** Substitui o banco atual pela cópia. A janela recarrega depois. */
  restaurarBackup: (input: RestaurarBackupInput) => Promise<void>
  abrirPastaBackups: () => Promise<void>
}

export { CONFIG_IPC_CHANNELS }
