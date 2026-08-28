import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'

export type BackupOptions = {
  /** Diretório onde as cópias são gravadas. Padrão: `<dir do db>/backups`. */
  backupsDir?: string
  /** Quantas cópias manter (as mais antigas além desse limite são removidas). */
  maxBackups?: number
  /**
   * Caminho de uma cópia que a retenção não pode remover.
   *
   * Existe para a restauração: ela faz um backup de segurança do estado atual
   * ANTES de sobrescrever o banco, e a retenção desse backup podia apagar
   * justamente a cópia que estava sendo restaurada — o `copyFileSync` seguinte
   * então falhava com ENOENT. Sem perda de dado (o banco nem chegava a ser
   * tocado), mas a restauração quebrava. Alcançável com a retenção padrão de
   * 10 assim que existissem dez cópias e a escolhida fosse a mais antiga.
   */
  preservar?: string
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

  aplicarRetencao(backupsDir, maxBackups, options.preservar)
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

/**
 * Resolve o caminho de uma cópia que pode ser restaurada, ou lança.
 *
 * `restaurarBackup` recebia o caminho do renderer e fazia `copyFileSync` dele
 * por cima do banco, verificando apenas que o arquivo existia. O main
 * emprestava seu poder de escrever no disco para um caminho que não escolheu —
 * confused deputy. Severidade baixa hoje, porque o renderer não tem superfície
 * de injeção, mas a guarda é barata e também protege contra um bug do renderer
 * mandando o caminho errado.
 *
 * **O invariante é "só se restaura o que o app lista".** Confrontar com
 * `listarBackups` em vez de reimplementar a regra mantém uma fonte de verdade
 * só: prefixo, extensão e pasta vêm de lá, e uma mudança lá não deixa esta
 * guarda para trás. Também descarta de graça travessia com `..`, o próprio
 * banco e qualquer arquivo de nome estranho largado na pasta.
 */
export function resolverBackupRestauravel(
  dbPath: string,
  backupsDir: string | undefined,
  caminho: string
): string {
  const alvo = resolve(caminho)
  const daLista = listarBackups(dbPath, backupsDir).find((c) => resolve(c.caminho) === alvo)

  if (!daLista) {
    throw new Error(
      'Cópia de backup inválida: o arquivo não está na pasta de backups do app ou não é uma cópia gerada por ele.'
    )
  }
  return daLista.caminho
}

/**
 * Valida a pasta escolhida para guardar as cópias.
 *
 * Caminho relativo resolveria contra o cwd, que num app empacotado é
 * imprevisível — e é onde `mkdirSync(recursive)` criaria a árvore. O fluxo
 * normal vem do diálogo do SO e é sempre absoluto; isto barra o resto.
 *
 * Não valida na LEITURA do settings de propósito: `lerConfig` cai nos defaults
 * quando o arquivo não passa no schema, então recusar aqui um valor já gravado
 * apagaria silenciosamente todas as outras configurações do usuário, o tema
 * incluído.
 */
export function validarPastaDeBackups(dir: string): void {
  if (dir.trim().length === 0) {
    throw new Error('Pasta de backups não pode ser vazia.')
  }
  if (!isAbsolute(dir)) {
    throw new Error(`Pasta de backups precisa ser um caminho absoluto: '${dir}'.`)
  }
}

/** `tally-2026-08-01T10-00-00-000Z.db` → `2026-08-01T10:00:00.000Z`. */
function decodificarStamp(nome: string): string {
  const stamp = nome.slice(PREFIX.length, -SUFFIX.length)
  const [data, hora] = stamp.split('T')
  if (!hora) return stamp
  const [h, m, s, ms] = hora.replace(/Z$/, '').split('-')
  return `${data}T${h}:${m}:${s}.${ms}Z`
}

function aplicarRetencao(backupsDir: string, maxBackups: number, preservar?: string): void {
  const copias = readdirSync(backupsDir)
    .filter((nome) => nome.startsWith(PREFIX) && nome.endsWith(SUFFIX))
    .sort()

  // Guardar uma a mais que o limite por um ciclo é o preço de não apagar a
  // cópia que está sendo restaurada. O próximo backup reequilibra.
  const protegido = preservar ? basename(resolve(preservar)) : null
  const excedentes = copias.slice(0, Math.max(0, copias.length - maxBackups))
  for (const nome of excedentes) {
    if (nome === protegido) continue
    rmSync(join(backupsDir, nome), { force: true })
  }
}
