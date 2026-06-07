import { describe, it, expect } from 'vitest'
import { openInMemoryDatabase } from '../database'

function bancoComTabela() {
  const db = openInMemoryDatabase()
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, v INTEGER)')
  return db
}

function valores(db: ReturnType<typeof bancoComTabela>): number[] {
  return (db.prepare('SELECT v FROM t ORDER BY v').all() as { v: number }[]).map((r) => r.v)
}

describe('Database.transaction (aninhamento via SAVEPOINT)', () => {
  it('commita transacoes aninhadas que terminam com sucesso', () => {
    const db = bancoComTabela()
    const externa = db.transaction(() => {
      db.prepare('INSERT INTO t (v) VALUES (?)').run(1)
      const interna = db.transaction(() => {
        db.prepare('INSERT INTO t (v) VALUES (?)').run(2)
      })
      interna()
    })
    externa()
    expect(valores(db)).toEqual([1, 2])
    db.close()
  })

  it('erro na transacao interna que propaga reverte tudo', () => {
    const db = bancoComTabela()
    const externa = db.transaction(() => {
      db.prepare('INSERT INTO t (v) VALUES (?)').run(1)
      const interna = db.transaction(() => {
        db.prepare('INSERT INTO t (v) VALUES (?)').run(2)
        throw new Error('falha interna')
      })
      interna()
    })
    expect(() => externa()).toThrow('falha interna')
    expect(valores(db)).toEqual([])
    db.close()
  })

  it('falha da interna pode ser tratada sem abortar a externa (rollback so do savepoint)', () => {
    const db = bancoComTabela()
    const externa = db.transaction(() => {
      db.prepare('INSERT INTO t (v) VALUES (?)').run(1)
      const interna = db.transaction(() => {
        db.prepare('INSERT INTO t (v) VALUES (?)').run(2)
        throw new Error('boom')
      })
      try {
        interna()
      } catch {
        // engolido: apenas o savepoint interno reverte; a externa segue
      }
      db.prepare('INSERT INTO t (v) VALUES (?)').run(3)
    })
    externa()
    // O insert 2 reverteu via savepoint; 1 e 3 permaneceram.
    expect(valores(db)).toEqual([1, 3])
    db.close()
  })
})
