import { z } from 'zod'
import { CONFIG_IPC_CHANNELS } from './channels'

// Configuracao do app persistida em <userData>/settings.json (fora do SQLite:
// nao consome numero de migration nem entra no export/import de dados).

/**
 * Tema da interface. O valor vai cru para o atributo `data-theme` do <html>,
 * que e o seletor do bloco de paleta em `styles/tokens.css` — dai ser
 * 'escuro' e nao 'dark'. 'claro' e o padrao e mora no `:root`, entao o
 * atributo so precisa existir de fato no escuro.
 */
export const temaSchema = z.enum(['claro', 'escuro'])

export type Tema = z.infer<typeof temaSchema>

export const configSchema = z.object({
  /** Pasta destino dos backups; null usa o padrao (<userData>/backups). */
  backupsDir: z.string().min(1).nullable(),
  backupAoSair: z.boolean(),
  retencaoBackups: z.number().int().min(1).max(100),
  notificacoesAtivas: z.boolean(),
  diasAntecedenciaAviso: z.number().int().min(0).max(15),
  tema: temaSchema
})

export type Config = z.infer<typeof configSchema>

export const CONFIG_DEFAULTS: Config = {
  backupsDir: null,
  backupAoSair: true,
  retencaoBackups: 10,
  notificacoesAtivas: true,
  diasAntecedenciaAviso: 3,
  tema: 'claro'
}

/**
 * Cor de fundo da janela por tema, para o `backgroundColor` da BrowserWindow.
 * Vive aqui, e nao no CSS, porque o main precisa dela ANTES de existir
 * pagina: sem ela o Chromium pinta branco ate o primeiro paint, e no tema
 * escuro isso e um flash branco de janela inteira.
 *
 * Espelha --bg de `styles/tokens.css`. Sao os dois unicos lugares onde essas
 * duas cores aparecem, e precisam concordar.
 */
export const COR_DE_FUNDO_POR_TEMA: Record<Tema, string> = {
  claro: '#f1ebdd',
  escuro: '#17140e'
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

export type TemaApi = {
  /**
   * Tema gravado, LIDO DE FORMA SINCRONA no preload. E a unica chamada
   * sincrona da ponte, e existe para um motivo especifico: o atributo precisa
   * estar no <html> antes de a folha de estilo pintar qualquer coisa. Por IPC
   * assincrono, o app abriria creme e viraria escuro depois que o React
   * montasse — o segundo dos dois flashes.
   */
  inicial: () => Tema
  /** Persiste a escolha. A troca visual e do renderer e ja aconteceu. */
  definir: (tema: Tema) => Promise<Tema>
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
