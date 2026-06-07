import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type BackupOptions = {
  /** Diretório onde as cópias são gravadas. Padrão: `<dir do db>/backups`. */
  backupsDir?: string
  /** Quantas cópias manter (as mais antigas além desse limite são removidas). */
  maxBackups?: number
  /** Injetável para testes determinísticos; padrão `new Date()`. */
  now?: Date
}

const PREFIX = 'tally-'
const SUFFIX = '.db'

/**
 * Faz uma cópia de segurança do arquivo do banco antes de qualquer operação
 * destrutiva (ex.: migrations no boot). Se o banco ainda não existe (primeira
 * execução), é um no-op e retorna null. Aplica retenção das N cópias mais
 * recentes. Nomes usam timestamp ISO (ordenável lexicograficamente).
 */
export function backupDatabase(dbPath: string, options: BackupOptions = {}): string | null {
  if (!existsSync(dbPath)) return null

  const backupsDir = options.backupsDir ?? join(dirname(dbPath), 'backups')
  const maxBackups = options.maxBackups ?? 10
  const now = options.now ?? new Date()

  mkdirSync(backupsDir, { recursive: true })

  const stamp = now.toISOString().replace(/[:.]/g, '-')
  const destino = join(backupsDir, `${PREFIX}${stamp}${SUFFIX}`)
  copyFileSync(dbPath, destino)

  aplicarRetencao(backupsDir, maxBackups)
  return destino
}

function aplicarRetencao(backupsDir: string, maxBackups: number): void {
  const copias = readdirSync(backupsDir)
    .filter((nome) => nome.startsWith(PREFIX) && nome.endsWith(SUFFIX))
    .sort()

  const excedentes = copias.slice(0, Math.max(0, copias.length - maxBackups))
  for (const nome of excedentes) {
    rmSync(join(backupsDir, nome), { force: true })
  }
}
