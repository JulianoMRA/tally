import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { loadBundledMigrations, runMigrations } from '../migrations/runner'

/**
 * Migration 0011 — entrada avulsa deixa de exigir fonte de renda.
 *
 * O que estava em jogo: `recebimento` nunca teve coluna de nome, entao todo
 * avulso era obrigado a criar uma `renda` Avulsa so para ter como se chamar.
 * A migration move esse nome para `recebimento.descricao`, solta o vinculo e
 * apaga as fontes que existiam so por causa dele.
 *
 * O risco real aqui e perda de dado: se o nome nao viajar junto, o usuario
 * perde a identificacao de todos os recebimentos avulsos do historico. Dai os
 * testes olharem o dado ANTES e DEPOIS, e nao so o schema final.
 */
describe('0011_avulso_sem_fonte', () => {
  let db: Database

  beforeEach(() => {
    db = openInMemoryDatabase()
  })

  function aplicarAte0010(): void {
    runMigrations(
      db,
      loadBundledMigrations().filter((m) => m.version < '0011')
    )
  }

  function aplicarTudo(): void {
    runMigrations(db)
  }

  function inserirRenda(nome: string, tipo: 'Avulsa' | 'Recorrente', dia: number | null): number {
    return Number(
      db
        .prepare(
          `INSERT INTO renda (nome, tipo, valor_padrao_centavos, dia_esperado)
           VALUES (?, ?, ?, ?)`
        )
        .run(nome, tipo, 50000, dia).lastInsertRowid
    )
  }

  function inserirRecebimento(rendaId: number | null, valor: number, data: string): number {
    return Number(
      db
        .prepare(
          `INSERT INTO recebimento (renda_id, valor_centavos, data_esperada, status)
           VALUES (?, ?, ?, 'Esperado')`
        )
        .run(rendaId, valor, data).lastInsertRowid
    )
  }

  type LinhaRecebimento = { renda_id: number | null; descricao: string | null }

  function lerRecebimento(id: number): LinhaRecebimento {
    return db
      .prepare('SELECT renda_id, descricao FROM recebimento WHERE id = ?')
      .get(id) as LinhaRecebimento
  }

  it('o recebimento de fonte Avulsa herda o nome dela e solta o vinculo', () => {
    aplicarAte0010()
    const fonteId = inserirRenda('Freela do cliente X', 'Avulsa', null)
    const recebimentoId = inserirRecebimento(fonteId, 120000, '2026-06-10')

    aplicarTudo()

    expect(lerRecebimento(recebimentoId)).toEqual({
      renda_id: null,
      descricao: 'Freela do cliente X'
    })
  })

  it('varios recebimentos da mesma fonte Avulsa herdam todos o mesmo nome', () => {
    aplicarAte0010()
    const fonteId = inserirRenda('Aulas particulares', 'Avulsa', null)
    const a = inserirRecebimento(fonteId, 10000, '2026-06-01')
    const b = inserirRecebimento(fonteId, 20000, '2026-07-01')

    aplicarTudo()

    expect(lerRecebimento(a).descricao).toBe('Aulas particulares')
    expect(lerRecebimento(b).descricao).toBe('Aulas particulares')
    expect(lerRecebimento(a).renda_id).toBeNull()
    expect(lerRecebimento(b).renda_id).toBeNull()
  })

  it('o recebimento de fonte Recorrente fica intacto — continua herdando pelo JOIN', () => {
    aplicarAte0010()
    const fonteId = inserirRenda('Bolsa PET', 'Recorrente', 5)
    const recebimentoId = inserirRecebimento(fonteId, 120000, '2026-06-05')

    aplicarTudo()

    expect(lerRecebimento(recebimentoId)).toEqual({ renda_id: fonteId, descricao: null })
  })

  it('as fontes Avulsa somem e as Recorrentes permanecem', () => {
    aplicarAte0010()
    const avulsa = inserirRenda('Presente', 'Avulsa', null)
    const recorrente = inserirRenda('Bolsa PET', 'Recorrente', 5)
    inserirRecebimento(avulsa, 5000, '2026-06-10')
    inserirRecebimento(recorrente, 120000, '2026-06-05')

    aplicarTudo()

    const nomes = (
      db.prepare('SELECT nome FROM renda ORDER BY nome').all() as { nome: string }[]
    ).map((r) => r.nome)
    expect(nomes).toEqual(['Bolsa PET'])
  })

  it('recebimento ja sem fonte ganha nome generico em vez de abortar a migration', () => {
    // O schema anterior permitia renda_id NULL e nenhum fluxo do app criava
    // essa linha — mas import de arquivo antigo podia. Sem o fallback, o CHECK
    // novo rejeitaria a linha e derrubaria a migration inteira.
    aplicarAte0010()
    const orfao = inserirRecebimento(null, 3000, '2026-06-20')

    aplicarTudo()

    expect(lerRecebimento(orfao)).toEqual({ renda_id: null, descricao: 'Recebimento avulso' })
  })

  it('preserva valor, datas e status ao reconstruir a tabela', () => {
    aplicarAte0010()
    const fonteId = inserirRenda('Freela', 'Avulsa', null)
    const id = Number(
      db
        .prepare(
          `INSERT INTO recebimento (renda_id, valor_centavos, data_esperada, data_recebida, status)
           VALUES (?, 45678, '2026-06-10', '2026-06-12', 'Recebido')`
        )
        .run(fonteId).lastInsertRowid
    )

    aplicarTudo()

    expect(db.prepare('SELECT * FROM recebimento WHERE id = ?').get(id)).toMatchObject({
      valor_centavos: 45678,
      data_esperada: '2026-06-10',
      data_recebida: '2026-06-12',
      status: 'Recebido'
    })
  })

  describe('o schema novo impede os estados que a regra proibe', () => {
    beforeEach(() => aplicarTudo())

    it('rejeita recebimento com fonte E descricao — sao mutuamente exclusivos', () => {
      const fonteId = inserirRenda('Bolsa PET', 'Recorrente', 5)
      expect(() =>
        db
          .prepare(
            `INSERT INTO recebimento (renda_id, descricao, valor_centavos, data_esperada)
             VALUES (?, 'nome proprio', 1000, '2026-06-01')`
          )
          .run(fonteId)
      ).toThrow()
    })

    it('rejeita recebimento sem fonte E sem descricao — ficaria sem como se chamar', () => {
      expect(() =>
        db
          .prepare(
            `INSERT INTO recebimento (renda_id, descricao, valor_centavos, data_esperada)
             VALUES (NULL, NULL, 1000, '2026-06-01')`
          )
          .run()
      ).toThrow()
    })

    it('aceita recebimento sem fonte quando tem descricao', () => {
      expect(() =>
        db
          .prepare(
            `INSERT INTO recebimento (renda_id, descricao, valor_centavos, data_esperada)
             VALUES (NULL, 'Freela avulso', 1000, '2026-06-01')`
          )
          .run()
      ).not.toThrow()
    })

    it("rejeita renda com tipo 'Avulsa'", () => {
      expect(() => inserirRenda('Nao deveria entrar', 'Avulsa', null)).toThrow()
    })

    it('exige dia_esperado na renda — so sobra Recorrente, e ela sempre tem dia', () => {
      expect(() => inserirRenda('Sem dia', 'Recorrente', null)).toThrow()
    })
  })
})
