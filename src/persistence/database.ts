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
  constructor(private readonly inner: WasmStatement) {}

  get<T = unknown>(...args: SpreadArg[]): T | undefined {
    const result = this.inner.get(toBinding(args))
    return (result ?? undefined) as T | undefined
  }

  all<T = unknown>(...args: SpreadArg[]): T[] {
    return this.inner.all(toBinding(args)) as T[]
  }

  run(...args: SpreadArg[]): RunResult {
    return normalizeRunResult(this.inner.run(toBinding(args)))
  }
}

export class Database {
  private readonly inner: WasmDatabase

  constructor(filename: string) {
    this.inner = new WasmDatabase(filename)
  }

  prepare(sql: string): Statement {
    return new Statement(this.inner.prepare(sql))
  }

  exec(sql: string): void {
    this.inner.exec(sql)
  }

  pragma(sql: string): void {
    this.inner.exec(`PRAGMA ${sql}`)
  }

  transaction<TFn extends (...args: unknown[]) => unknown>(fn: TFn): TFn {
    const wrapped = ((...args: unknown[]) => {
      this.inner.exec('BEGIN')
      try {
        const result = fn(...args)
        this.inner.exec('COMMIT')
        return result
      } catch (err) {
        if (this.inner.inTransaction) {
          this.inner.exec('ROLLBACK')
        }
        throw err
      }
    }) as unknown as TFn
    return wrapped
  }

  close(): void {
    this.inner.close()
  }

  get inTransaction(): boolean {
    return this.inner.inTransaction
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
