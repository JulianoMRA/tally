import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { TagRepository } from '../repositories/tag-repository'

function inserirDespesa(db: Database, id: number): void {
  db.prepare(
    `INSERT INTO despesa (id, descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
     VALUES (?, 'Compra', 1, 'Unica', 'Credito', 1, 5000, 1, '2026-06-03')`
  ).run(id)
}

describe('TagRepository', () => {
  let db: Database
  let repo: TagRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new TagRepository(db)
    db.exec(
      `INSERT INTO cartao (id, nome, dia_fechamento, dia_vencimento, cor) VALUES (1, 'Inter', 5, 12, '#f60')`
    )
    db.exec(`INSERT INTO categoria (id, nome, tipo, cor) VALUES (1, 'Mercado', 'Despesa', '#fa0')`)
  })

  it('upsertPorNome cria e reaproveita a tag (case-insensitive), aparando espaços', () => {
    const a = repo.upsertPorNome('  Viagem  ')
    const b = repo.upsertPorNome('viagem')
    expect(a.id).toBe(b.id)
    expect(a.nome).toBe('Viagem')
    expect(repo.listar()).toHaveLength(1)
  })

  it('listar devolve as tags ordenadas por nome', () => {
    repo.upsertPorNome('Zebra')
    repo.upsertPorNome('Abacaxi')
    expect(repo.listar().map((t) => t.nome)).toEqual(['Abacaxi', 'Zebra'])
  })

  it('sincronizarDespesa substitui o conjunto de tags e ignora vazias/duplicadas', () => {
    inserirDespesa(db, 10)
    repo.sincronizarDespesa(10, ['Viagem', 'trabalho', '  ', 'Viagem'])
    expect(
      repo
        .tagsDaDespesa(10)
        .map((t) => t.nome)
        .sort()
    ).toEqual(['Viagem', 'trabalho'])

    repo.sincronizarDespesa(10, ['trabalho'])
    expect(repo.tagsDaDespesa(10).map((t) => t.nome)).toEqual(['trabalho'])

    repo.sincronizarDespesa(10, [])
    expect(repo.tagsDaDespesa(10)).toEqual([])
  })

  it('tagsPorDespesaIds devolve o mapa em lote', () => {
    inserirDespesa(db, 10)
    inserirDespesa(db, 11)
    repo.sincronizarDespesa(10, ['Viagem'])
    repo.sincronizarDespesa(11, ['Casa', 'Viagem'])

    const mapa = repo.tagsPorDespesaIds([10, 11, 99])
    expect(mapa.get(10)).toEqual(['Viagem'])
    expect(mapa.get(11)?.sort()).toEqual(['Casa', 'Viagem'])
    expect(mapa.get(99)).toBeUndefined()
  })

  it('remover tags de uma despesa não apaga a tag compartilhada por outra', () => {
    inserirDespesa(db, 10)
    inserirDespesa(db, 11)
    repo.sincronizarDespesa(10, ['Viagem'])
    repo.sincronizarDespesa(11, ['Viagem'])

    repo.sincronizarDespesa(10, [])
    expect(repo.tagsDaDespesa(11).map((t) => t.nome)).toEqual(['Viagem'])
    expect(repo.listar()).toHaveLength(1)
  })
})
