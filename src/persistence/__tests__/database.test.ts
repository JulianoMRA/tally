import { describe, it, expect } from 'vitest'
import { openInMemoryDatabase } from '../database'

describe('openInMemoryDatabase', () => {
  it('should open, execute SELECT 1 and close without errors', () => {
    const db = openInMemoryDatabase()
    const result = db.prepare('SELECT 1 AS value').get() as { value: number }
    expect(result.value).toBe(1)
    db.close()
  })

  it('should enforce foreign keys', () => {
    const db = openInMemoryDatabase()
    const row = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }
    expect(row.foreign_keys).toBe(1)
    db.close()
  })
})

describe('Database — ciclo de vida dos prepared statements', () => {
  // A node-sqlite3-wasm exige finalize() manual em todo statement preparado
  // fora dos atalhos db.all/get/run. O wrapper nunca finalizava, e isso tinha
  // dois efeitos medidos: memoria que so cresce (20 mil prepare = +44 MB de
  // RSS) e, pior, `Statement.get()` parando o cursor na primeira linha sem
  // reset — o que deixa a tabela travada para DDL pelo resto do processo.

  it('libera a tabela depois de um get, para que DDL posterior nao falhe', () => {
    const db = openInMemoryDatabase()
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)')
    db.exec("INSERT INTO t (v) VALUES ('a'), ('b'), ('c')")

    // get() para na primeira linha: com o cursor aberto, o DROP abaixo falha
    // com "database table is locked".
    expect(db.prepare('SELECT * FROM t').get()).toEqual({ id: 1, v: 'a' })

    expect(() => db.exec('DROP TABLE t')).not.toThrow()
    db.close()
  })

  it('reaproveita o statement do mesmo SQL em vez de acumular um por chamada', () => {
    const db = openInMemoryDatabase()
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)')

    const insert = 'INSERT INTO t (v) VALUES (?)'
    for (let i = 0; i < 500; i++) {
      db.prepare(insert).run(`linha ${i}`)
    }

    expect(db.openStatements).toBe(1)
    expect((db.prepare('SELECT COUNT(*) AS n FROM t').get() as { n: number }).n).toBe(500)
    db.close()
  })

  it('conta um statement por SQL distinto', () => {
    const db = openInMemoryDatabase()
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)')

    db.prepare('SELECT * FROM t').all()
    db.prepare('SELECT id FROM t').all()
    db.prepare('SELECT * FROM t').all()

    expect(db.openStatements).toBe(2)
    db.close()
  })

  it('finaliza todos os statements ao fechar a conexao', () => {
    const db = openInMemoryDatabase()
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)')
    db.prepare('SELECT * FROM t').all()
    db.prepare('INSERT INTO t (v) VALUES (?)').run('a')
    expect(db.openStatements).toBeGreaterThan(0)

    db.close()

    expect(db.openStatements).toBe(0)
  })
})

describe('Database — statement que falha nao volta quebrado do cache', () => {
  // Um statement que quebrou no meio guarda o codigo de erro: reset e finalize
  // seguintes o repetem. Com cache, a segunda chamada morreria com "Could not
  // reset statement prior to binding new values" no lugar da causa real, e o
  // close() lancaria o erro de uma operacao encerrada ha muito tempo.

  it('repete a causa real, nao o eco do reset, quando o mesmo SQL falha duas vezes', () => {
    const db = openInMemoryDatabase()
    db.exec("CREATE TABLE t (v TEXT CHECK (v IN ('a', 'b')))")
    const inserir = (v: string): void => {
      db.prepare('INSERT INTO t (v) VALUES (?)').run(v)
    }

    expect(() => inserir('x')).toThrow(/CHECK/i)
    expect(() => inserir('y')).toThrow(/CHECK/i)

    db.close()
  })

  it('volta a funcionar com valor valido depois da falha', () => {
    const db = openInMemoryDatabase()
    db.exec("CREATE TABLE t (v TEXT CHECK (v IN ('a', 'b')))")
    const inserir = (v: string): void => {
      db.prepare('INSERT INTO t (v) VALUES (?)').run(v)
    }

    expect(() => inserir('x')).toThrow(/CHECK/i)
    expect(() => inserir('a')).not.toThrow()

    expect((db.prepare('SELECT COUNT(*) AS n FROM t').get() as { n: number }).n).toBe(1)
    db.close()
  })

  it('nao deixa o statement quebrado no cache para o close tropecar nele', () => {
    const db = openInMemoryDatabase()
    db.exec("CREATE TABLE t (v TEXT CHECK (v IN ('a', 'b')))")

    expect(() => db.prepare('INSERT INTO t (v) VALUES (?)').run('x')).toThrow(/CHECK/i)

    expect(db.openStatements).toBe(0)
    expect(() => db.close()).not.toThrow()
  })
})
