import {
  Database as WasmDatabase,
  type Statement as WasmStatement,
  type RunResult as WasmRunResult,
  type BindValues
} from 'node-sqlite3-wasm'

export type RunResult = {
  changes: number
  lastInsertRowid: number | bigint
}

type SpreadArg = number | bigint | string | Uint8Array | boolean | null | undefined

function toBinding(args: SpreadArg[]): BindValues | undefined {
  if (args.length === 0) return undefined
  if (args.length === 1) {
    const v = args[0]
    return (v === undefined ? null : v) as BindValues
  }
  return args.map((v) => (v === undefined ? null : v)) as BindValues
}

function normalizeRunResult(r: WasmRunResult): RunResult {
  return {
    changes: r.changes,
    lastInsertRowid:
      typeof r.lastInsertRowid === 'bigint' && r.lastInsertRowid <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(r.lastInsertRowid)
        : r.lastInsertRowid
  }
}

class Statement {
  constructor(
    private readonly db: WasmDatabase,
    private readonly sql: string,
    private readonly preparado: WasmStatement,
    private readonly descartar: () => void
  ) {}

  /**
   * Nao usa o statement do cache de proposito.
   *
   * `WasmStatement.get()` para o cursor na primeira linha e NAO o reseta — a
   * varredura fica aberta ate a proxima execucao ou o finalize. Enquanto
   * estiver aberta, a tabela recusa DDL: um `DROP TABLE` posterior morre com
   * "database table is locked". Como o cache faz o statement viver ate o
   * `close()`, reaproveita-lo aqui deixaria a tabela travada pelo resto do
   * processo — e as migrations 0003, 0007 e 0011 usam create-copy-drop-rename.
   *
   * `WasmDatabase.get()` prepara, executa e finaliza internamente, entao nao
   * sobra cursor. `all()` e `run()` esgotam o cursor sozinhos e podem usar o
   * cache normalmente.
   */
  get<T = unknown>(...args: SpreadArg[]): T | undefined {
    const result = this.db.get(this.sql, toBinding(args))
    return (result ?? undefined) as T | undefined
  }

  all<T = unknown>(...args: SpreadArg[]): T[] {
    return this.executar(() => this.preparado.all(toBinding(args)) as T[])
  }

  run(...args: SpreadArg[]): RunResult {
    return normalizeRunResult(this.executar(() => this.preparado.run(toBinding(args))))
  }

  /**
   * Executa descartando o statement se ele falhar.
   *
   * Um statement que quebrou no meio guarda o codigo de erro, e tanto o reset
   * quanto o finalize seguintes o repetem. Reaproveitar esse statement faz a
   * SEGUNDA chamada morrer com "Could not reset statement prior to binding new
   * values" em vez da causa real — e o `close()` passa a lancar o erro de uma
   * operacao encerrada ha muito tempo. Sem o cache isso nao aparecia: cada
   * `prepare` devolvia um statement novo e o quebrado era simplesmente
   * abandonado. Descartar aqui preserva esse comportamento.
   */
  private executar<T>(fn: () => T): T {
    try {
      return fn()
    } catch (err) {
      this.descartar()
      throw err
    }
  }
}

export class Database {
  private readonly inner: WasmDatabase
  private savepointSeq = 0
  /**
   * Statements vivos, indexados pelo SQL que os originou.
   *
   * A node-sqlite3-wasm exige `finalize()` manual em todo statement preparado
   * fora dos atalhos `all`/`get`/`run` da propria conexao — sem isso a memoria
   * do WASM so cresce (medido: 20 mil `prepare` sem finalize custam ~44 MB de
   * RSS; com finalize, zero). O wrapper preparava um statement novo a cada
   * chamada e nunca finalizava nenhum, num app que fica aberto o dia inteiro.
   *
   * Indexar pelo SQL resolve os dois lados: o mesmo texto reaproveita o mesmo
   * statement, e o `close()` tem a lista completa para finalizar. O conjunto e
   * limitado pelos textos de SQL distintos do codigo; as poucas consultas com
   * `IN (?, ?, ...)` montado na hora criam uma entrada por aridade, o que a
   * pratica limita a algumas centenas de entradas de ~2 KB.
   */
  private readonly statements = new Map<string, WasmStatement>()

  constructor(filename: string) {
    this.inner = new WasmDatabase(filename)
  }

  prepare(sql: string): Statement {
    let preparado = this.statements.get(sql)
    if (!preparado) {
      // Preparar aqui, e nao na primeira execucao, preserva o fail-fast: SQL
      // invalido continua lancando no `prepare`, nao mais tarde.
      preparado = this.inner.prepare(sql)
      this.statements.set(sql, preparado)
    }
    return new Statement(this.inner, sql, preparado, () => this.descartar(sql))
  }

  /**
   * Tira do cache o statement que falhou e o finaliza.
   *
   * O `finalize` de um statement que quebrou repete o erro daquela execucao —
   * erro que ja foi propagado ao chamador pelo `Statement.executar`. Engolir
   * aqui evita substituir a causa real por um eco dela.
   */
  private descartar(sql: string): void {
    const preparado = this.statements.get(sql)
    if (!preparado) return
    this.statements.delete(sql)
    try {
      preparado.finalize()
    } catch {
      // Eco do erro ja propagado; nao ha o que tratar.
    }
  }

  exec(sql: string): void {
    this.inner.exec(sql)
  }

  pragma(sql: string): void {
    this.inner.exec(`PRAGMA ${sql}`)
  }

  // Suporta aninhamento: uma transacao dentro de outra usa SAVEPOINT em vez de
  // BEGIN (que o SQLite rejeitaria). A interna so reverte seu proprio savepoint;
  // se o erro propagar, a externa reverte tudo. Sem aninhamento, BEGIN/COMMIT.
  transaction<TFn extends (...args: unknown[]) => unknown>(fn: TFn): TFn {
    const wrapped = ((...args: unknown[]) => {
      const aninhada = this.inner.inTransaction
      const savepoint = `sp_${(this.savepointSeq += 1)}`
      this.inner.exec(aninhada ? `SAVEPOINT ${savepoint}` : 'BEGIN')
      try {
        const result = fn(...args)
        this.inner.exec(aninhada ? `RELEASE ${savepoint}` : 'COMMIT')
        return result
      } catch (err) {
        if (aninhada) {
          this.inner.exec(`ROLLBACK TO ${savepoint}`)
          this.inner.exec(`RELEASE ${savepoint}`)
        } else if (this.inner.inTransaction) {
          this.inner.exec('ROLLBACK')
        }
        throw err
      }
    }) as unknown as TFn
    return wrapped
  }

  close(): void {
    // Antes do close: `close_v2` nao finaliza statement nenhum — ele apenas
    // marca a conexao e adia o fechamento real enquanto houver statement vivo.
    // Fechar sem finalizar deixava a conexao em estado zumbi e a memoria presa.
    for (const preparado of this.statements.values()) {
      try {
        preparado.finalize()
      } catch {
        // Mesmo motivo do `descartar`: finalize de statement que falhou repete
        // o erro daquela execucao. Fechar a conexao nao pode depender disso.
      }
    }
    this.statements.clear()
    this.inner.close()
  }

  get inTransaction(): boolean {
    return this.inner.inTransaction
  }

  /** Diagnostico: quantos statements a conexao mantem vivos. Usado nos testes. */
  get openStatements(): number {
    return this.statements.size
  }
}

export function openDatabase(path: string): Database {
  const db = new Database(path)
  db.pragma('busy_timeout = 5000')
  db.pragma('foreign_keys = ON')
  return db
}

export function openInMemoryDatabase(): Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  return db
}
