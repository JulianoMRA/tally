import { describe, it, expect } from 'vitest'
import { openInMemoryDatabase, type Database } from '../database'
import { runMigrations } from '../migrations/runner'
import { DadosRepository } from '../repositories/dados-repository'

function novoBanco(): Database {
  const db = openInMemoryDatabase()
  runMigrations(db)
  return db
}

function seedBasico(db: Database): void {
  db.exec(
    `INSERT INTO cartao (id, nome, dia_fechamento, dia_vencimento, cor) VALUES (1, 'Inter', 5, 12, '#ff7a00')`
  )
  db.exec(`INSERT INTO categoria (id, nome, tipo, cor) VALUES (1, 'Mercado', 'Despesa', '#abcdef')`)
  db.exec(
    `INSERT INTO orcamento (id, categoria_id, mes_referencia, valor_limite_centavos) VALUES (1, 1, NULL, 50000)`
  )
  db.exec(
    `INSERT INTO despesa (id, descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
     VALUES (1, 'Compra', 1, 'Unica', 'Credito', 1, 5000, 1, '2026-06-03')`
  )
  db.exec(
    `INSERT INTO fatura (id, cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
     VALUES (1, 1, '2026-06', '2026-06-05', '2026-06-12', 'Aberta')`
  )
  db.exec(
    `INSERT INTO parcela (id, despesa_id, fatura_id, numero, total, valor_centavos, data_referencia)
     VALUES (1, 1, 1, 1, 1, 5000, '2026-06-03')`
  )
  db.exec(
    `INSERT INTO renda (id, nome, tipo, valor_padrao_centavos, dia_esperado) VALUES (1, 'Bolsa', 'Recorrente', 80000, 5)`
  )
  db.exec(
    `INSERT INTO recebimento (id, renda_id, valor_centavos, data_esperada, status) VALUES (1, 1, 80000, '2026-06-05', 'Esperado')`
  )
}

function contar(db: Database, tabela: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).get() as { n: number }
  return row.n
}

describe('DadosRepository', () => {
  it('exporta todas as tabelas com a versao de schema atual', () => {
    const db = novoBanco()
    seedBasico(db)

    const payload = new DadosRepository(db).exportar()

    expect(payload.formatVersion).toBe(1)
    expect(payload.app.schemaVersion).toMatch(/^0008/)
    expect(payload.tables.cartao).toHaveLength(1)
    expect(payload.tables.orcamento).toHaveLength(1)
    expect(payload.tables.parcela).toHaveLength(1)
    expect(payload.tables.recebimento).toHaveLength(1)
    db.close()
  })

  it('faz round-trip: exporta de um banco e importa em outro identico', () => {
    const origem = novoBanco()
    seedBasico(origem)
    const payload = new DadosRepository(origem).exportar()

    const destino = novoBanco()
    const { totalLinhas } = new DadosRepository(destino).importar(payload)

    expect(totalLinhas).toBe(8)
    expect(contar(destino, 'cartao')).toBe(1)
    expect(contar(destino, 'orcamento')).toBe(1)
    expect(contar(destino, 'despesa')).toBe(1)
    expect(contar(destino, 'parcela')).toBe(1)
    const despesa = destino.prepare('SELECT descricao FROM despesa WHERE id = 1').get() as {
      descricao: string
    }
    expect(despesa.descricao).toBe('Compra')
    origem.close()
    destino.close()
  })

  it('round-trip preserva nota, tags e seus vínculos', () => {
    const origem = novoBanco()
    seedBasico(origem)
    origem.exec(`UPDATE despesa SET nota = 'Reembolsável' WHERE id = 1`)
    origem.exec(`INSERT INTO tag (id, nome) VALUES (1, 'Viagem')`)
    origem.exec(`INSERT INTO despesa_tag (despesa_id, tag_id) VALUES (1, 1)`)
    const payload = new DadosRepository(origem).exportar()

    const destino = novoBanco()
    new DadosRepository(destino).importar(payload)

    expect(destino.prepare('SELECT nota FROM despesa WHERE id = 1').get()).toEqual({
      nota: 'Reembolsável'
    })
    expect(contar(destino, 'tag')).toBe(1)
    expect(contar(destino, 'despesa_tag')).toBe(1)
    origem.close()
    destino.close()
  })

  it('substitui os dados existentes (nao acumula)', () => {
    const origem = novoBanco()
    seedBasico(origem)
    const payload = new DadosRepository(origem).exportar()

    const destino = novoBanco()
    destino.exec(
      `INSERT INTO cartao (id, nome, dia_fechamento, dia_vencimento, cor) VALUES (99, 'Antigo', 1, 1, '#000000')`
    )

    new DadosRepository(destino).importar(payload)

    expect(contar(destino, 'cartao')).toBe(1)
    expect(destino.prepare('SELECT nome FROM cartao').get()).toEqual({ nome: 'Inter' })
    origem.close()
    destino.close()
  })

  it('aceita export de versao de schema anterior (backup sobrevive a migrations novas)', () => {
    const origem = novoBanco()
    seedBasico(origem)
    const payload = new DadosRepository(origem).exportar()
    payload.app.schemaVersion = '0006_backfill_parcelas_pagas'

    const destino = novoBanco()
    const { totalLinhas } = new DadosRepository(destino).importar(payload)

    expect(totalLinhas).toBe(8)
    expect(contar(destino, 'cartao')).toBe(1)
    origem.close()
    destino.close()
  })

  it('rejeita export de versao de schema mais nova que a do app, sem alterar os dados', () => {
    const origem = novoBanco()
    seedBasico(origem)
    const payload = new DadosRepository(origem).exportar()
    payload.app.schemaVersion = '9999_schema_do_futuro'

    const destino = novoBanco()
    destino.exec(
      `INSERT INTO cartao (id, nome, dia_fechamento, dia_vencimento, cor) VALUES (99, 'Antigo', 1, 1, '#000000')`
    )

    expect(() => new DadosRepository(destino).importar(payload)).toThrow(/incompativel/)
    expect(contar(destino, 'cartao')).toBe(1)
    expect(destino.prepare('SELECT nome FROM cartao').get()).toEqual({ nome: 'Antigo' })
    origem.close()
    destino.close()
  })

  it('rejeita export com versao de schema malformada', () => {
    const origem = novoBanco()
    seedBasico(origem)
    const payload = new DadosRepository(origem).exportar()
    payload.app.schemaVersion = 'sem-prefixo-numerico'

    const destino = novoBanco()
    expect(() => new DadosRepository(destino).importar(payload)).toThrow(/incompativel/)
    origem.close()
    destino.close()
  })

  it('e atomico: falha de constraint no meio do import faz rollback completo', () => {
    const origem = novoBanco()
    seedBasico(origem)
    const payload = new DadosRepository(origem).exportar()
    // Corrompe uma linha de forma a violar o CHECK de forma_pagamento.
    ;(payload.tables.despesa[0] as Record<string, unknown>).forma_pagamento = 'INVALIDO'

    const destino = novoBanco()
    destino.exec(
      `INSERT INTO cartao (id, nome, dia_fechamento, dia_vencimento, cor) VALUES (99, 'Antigo', 1, 1, '#000000')`
    )

    expect(() => new DadosRepository(destino).importar(payload)).toThrow()
    // Rollback: os dados originais do destino permanecem intactos.
    expect(contar(destino, 'cartao')).toBe(1)
    expect(destino.prepare('SELECT nome FROM cartao').get()).toEqual({ nome: 'Antigo' })
    origem.close()
    destino.close()
  })
})
