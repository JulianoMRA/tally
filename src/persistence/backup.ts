import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
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

export type CopiaDeBackup = {
  caminho: string
  /** ISO do instante da cópia, decodificado do nome do arquivo. */
  criadoEm: string
  tamanhoBytes: number
}

/**
 * Lista as cópias existentes, da mais recente para a mais antiga.
 *
 * O app criava backups no boot e na saída, mas não havia como vê-los nem
 * restaurá-los pela interface — só mexendo em arquivo na mão.
 */
export function listarBackups(dbPath: string, backupsDir?: string): CopiaDeBackup[] {
  const dir = backupsDir ?? join(dirname(dbPath), 'backups')
  if (!existsSync(dir)) return []

  return (
    readdirSync(dir)
      .filter((nome) => nome.startsWith(PREFIX) && nome.endsWith(SUFFIX))
      // O nome usa timestamp ISO com ':' e '.' trocados por '-', então a ordem
      // lexicográfica já é cronológica: basta inverter.
      .sort()
      .reverse()
      .map((nome) => {
        const caminho = join(dir, nome)
        return {
          caminho,
          criadoEm: decodificarStamp(nome),
          tamanhoBytes: statSync(caminho).size
        }
      })
  )
}

/** `tally-2026-08-01T10-00-00-000Z.db` → `2026-08-01T10:00:00.000Z`. */
function decodificarStamp(nome: string): string {
  const stamp = nome.slice(PREFIX.length, -SUFFIX.length)
  const [data, hora] = stamp.split('T')
  if (!hora) return stamp
  const [h, m, s, ms] = hora.replace(/Z$/, '').split('-')
  return `${data}T${h}:${m}:${s}.${ms}Z`
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
