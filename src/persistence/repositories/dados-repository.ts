import type { Database } from '../database'
import type { Repository } from './types'
import type { ExportPayload } from '../../shared/ipc/dados'

// Nomes de tabela sao constantes do proprio codigo (nunca vem do arquivo),
// entao a interpolacao em SQL aqui e segura. Os valores sao sempre parametrizados.
// Ordem segura para FKs: filhos antes dos pais ao apagar; pais antes dos filhos ao inserir.
const ORDEM_DELETE = [
  'parcela',
  'recebimento',
  'fatura',
  'despesa',
  'renda',
  'categoria',
  'cartao'
] as const
const ORDEM_INSERT = [
  'cartao',
  'categoria',
  'renda',
  'despesa',
  'fatura',
  'parcela',
  'recebimento'
] as const

export class DadosRepository implements Repository {
  constructor(public readonly db: Database) {}

  private schemaVersion(): string {
    const row = this.db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as {
      v: string | null
    }
    return row?.v ?? ''
  }

  private colunas(tabela: string): string[] {
    const rows = this.db.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[]
    return rows.map((r) => r.name)
  }

  /** Dump de todas as tabelas de dados em um payload versionado. */
  exportar(): ExportPayload {
    return {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      app: { name: 'tally', schemaVersion: this.schemaVersion() },
      tables: {
        cartao: this.lerTabela('cartao'),
        categoria: this.lerTabela('categoria'),
        despesa: this.lerTabela('despesa'),
        fatura: this.lerTabela('fatura'),
        parcela: this.lerTabela('parcela'),
        renda: this.lerTabela('renda'),
        recebimento: this.lerTabela('recebimento')
      }
    }
  }

  private lerTabela(tabela: (typeof ORDEM_INSERT)[number]): Record<string, unknown>[] {
    return this.db.prepare(`SELECT * FROM ${tabela}`).all() as Record<string, unknown>[]
  }

  /**
   * Substitui TODOS os dados pelos do payload, de forma atomica. Rejeita se a
   * versao de schema do arquivo nao bate com a do app (evita formatos divergentes).
   * Deve ser chamado apos um backup do banco (responsabilidade do caller).
   */
  importar(payload: ExportPayload): { totalLinhas: number } {
    if (payload.formatVersion !== 1) {
      throw new Error(`Formato de arquivo nao suportado: ${String(payload.formatVersion)}`)
    }
    const atual = this.schemaVersion()
    if (payload.app.schemaVersion !== atual) {
      throw new Error(
        `Versao de schema incompativel (arquivo=${payload.app.schemaVersion}, app=${atual}). ` +
          `Importe um arquivo gerado por esta versao do Tally.`
      )
    }

    return this.db.transaction(() => {
      for (const tabela of ORDEM_DELETE) {
        this.db.exec(`DELETE FROM ${tabela}`)
      }

      let totalLinhas = 0
      for (const tabela of ORDEM_INSERT) {
        const linhas = payload.tables[tabela] ?? []
        if (linhas.length === 0) continue
        const cols = this.colunas(tabela)
        const placeholders = cols.map(() => '?').join(', ')
        const stmt = this.db.prepare(
          `INSERT INTO ${tabela} (${cols.join(', ')}) VALUES (${placeholders})`
        )
        for (const linha of linhas) {
          const valores = cols.map((c) => (linha[c] ?? null) as string | number | null)
          stmt.run(...valores)
          totalLinhas++
        }
      }
      return { totalLinhas }
    })()
  }
}
