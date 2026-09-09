import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { loadBundledMigrations, runMigrations } from '../migrations/runner'

/**
 * Migration 0014 — `categoria.tipo` sai.
 *
 * A coluna separava categorias de despesa das de renda. O Slice 12.1 removeu
 * `renda.categoria_id`, e desde então renda não tem categoria: só 'Despesa' é
 * pedido, e uma categoria criada como 'Renda' ficava inalcançável em todo o app.
 *
 * O risco aqui não é perda de nome, como na 0011 — é perda de VÍNCULO. A tabela
 * é referenciada por FK de `despesa` e de `orcamento`, e o pattern
 * recreate-table dropa e recria. Se os ids não sobrevivessem intactos, despesas
 * e limites apontariam para o vazio. Daí os testes olharem os vínculos depois,
 * e não só o schema.
 */
describe('0014_categoria_sem_tipo', () => {
  let db: Database

  beforeEach(() => {
    db = openInMemoryDatabase()
  })

  function aplicarAte0013(): void {
    runMigrations(
      db,
      loadBundledMigrations().filter((m) => m.version < '0014')
    )
  }

  function colunasDeCategoria(): string[] {
    const rows = db.prepare('PRAGMA table_info(categoria)').all() as { name: string }[]
    return rows.map((r) => r.name)
  }

  it('remove a coluna tipo e preserva as demais', () => {
    aplicarAte0013()
    expect(colunasDeCategoria()).toContain('tipo')

    runMigrations(db)

    expect(colunasDeCategoria()).not.toContain('tipo')
    expect(colunasDeCategoria()).toEqual(['id', 'nome', 'cor', 'ativo', 'created_at', 'updated_at'])
  })

  it('preserva as categorias com id, nome, cor e ativo intactos', () => {
    aplicarAte0013()
    db.prepare(
      "INSERT INTO categoria (nome, tipo, cor, ativo) VALUES ('Mercado', 'Despesa', '#4caf50', 1)"
    ).run()
    db.prepare(
      "INSERT INTO categoria (nome, tipo, cor, ativo) VALUES ('Arquivada', 'Despesa', '#888', 0)"
    ).run()

    runMigrations(db)

    const linhas = db.prepare('SELECT id, nome, cor, ativo FROM categoria ORDER BY id').all() as {
      id: number
      nome: string
      cor: string
      ativo: number
    }[]
    expect(linhas).toEqual([
      { id: 1, nome: 'Mercado', cor: '#4caf50', ativo: 1 },
      { id: 2, nome: 'Arquivada', cor: '#888', ativo: 0 }
    ])
  })

  /**
   * O ponto da migration. Uma categoria 'Renda' era inalcançável no app, mas
   * existe no banco de quem criou uma — e não pode sumir por isso. Ela vira uma
   * categoria comum, que é o que o app já a trataria como sendo se pudesse
   * enxergá-la.
   */
  it('preserva categoria que era Renda ou Ambos, sem apagar nem renomear', () => {
    aplicarAte0013()
    db.prepare(
      "INSERT INTO categoria (nome, tipo, cor) VALUES ('Salário', 'Renda', '#ffeb3b')"
    ).run()
    db.prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Geral', 'Ambos', '#9e9e9e')").run()

    runMigrations(db)

    const nomes = (
      db.prepare('SELECT nome FROM categoria ORDER BY id').all() as { nome: string }[]
    ).map((r) => r.nome)
    expect(nomes).toEqual(['Salário', 'Geral'])
  })

  /**
   * `despesa` e `orcamento` referenciam `categoria(id)`. O recreate-table dropa
   * a tabela referenciada, então este é o teste que prova que o vínculo
   * sobreviveu — e não apenas que a coluna sumiu.
   */
  it('mantém os vínculos de despesa e orcamento com a categoria', () => {
    aplicarAte0013()
    const catId = Number(
      db
        .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Casa', 'Despesa', '#3f6e47')")
        .run().lastInsertRowid
    )
    db.prepare(
      `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, data_compra)
       VALUES ('Feira', ?, 'Unica', 'Pix', NULL, 8500, '2026-09-08')`
    ).run(catId)
    db.prepare(
      `INSERT INTO orcamento (categoria_id, mes_referencia, valor_limite_centavos)
       VALUES (?, NULL, 50000)`
    ).run(catId)

    runMigrations(db)

    const despesa = db
      .prepare('SELECT categoria_id FROM despesa WHERE descricao = ?')
      .get('Feira') as { categoria_id: number }
    const orcamento = db.prepare('SELECT categoria_id FROM orcamento').get() as {
      categoria_id: number
    }
    expect(despesa.categoria_id).toBe(catId)
    expect(orcamento.categoria_id).toBe(catId)

    // O JOIN precisa continuar resolvendo: id preservado sem a linha do outro
    // lado seria vínculo órfão passando despercebido.
    const join = db
      .prepare('SELECT c.nome FROM despesa d JOIN categoria c ON c.id = d.categoria_id')
      .get() as { nome: string }
    expect(join.nome).toBe('Casa')
  })

  it('deixa as foreign keys ligadas ao final', () => {
    aplicarAte0013()
    runMigrations(db)

    const [{ foreign_keys: ligadas }] = db.prepare('PRAGMA foreign_keys').all() as {
      foreign_keys: number
    }[]
    expect(ligadas).toBe(1)
  })
})
