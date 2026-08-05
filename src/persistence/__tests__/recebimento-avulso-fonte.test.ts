import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { RecebimentoRepository } from '../repositories/recebimento-repository'
import { RendaRepository } from '../repositories/renda-repository'

/**
 * `criarAvulsoCompleto` fazia `INSERT INTO renda` incondicional: cada
 * "+ Novo avulso" criava uma fonte nova. Três freelas do mesmo cliente viravam
 * três fontes idênticas na aba Fontes. E as fontes avulsas cadastradas à mão
 * não eram reutilizáveis por nenhum fluxo — existiam sem propósito.
 *
 * O input passa a aceitar `rendaId` (reusa a fonte) OU `nome` (cria uma).
 */
describe('RecebimentoRepository.criarAvulsoCompleto', () => {
  let db: Database
  let repo: RecebimentoRepository
  let rendas: RendaRepository

  function contarRendas(): number {
    const row = db.prepare('SELECT COUNT(*) AS n FROM renda').get() as { n: number }
    return Number(row.n)
  }

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new RecebimentoRepository(db)
    rendas = new RendaRepository(db)
  })

  it('cria a fonte quando recebe um nome novo', () => {
    const recebimento = repo.criarAvulsoCompleto({
      nome: 'Freela de design',
      valorCentavos: 150_000,
      dataEsperada: '2026-08-10'
    })

    expect(contarRendas()).toBe(1)
    expect(recebimento.rendaId).not.toBeNull()
    const fonte = rendas.findById(recebimento.rendaId!)
    expect(fonte).toMatchObject({ nome: 'Freela de design', tipo: 'Avulsa' })
  })

  it('reutiliza a fonte existente quando recebe rendaId', () => {
    const fonte = rendas.criarAvulsa({ nome: 'Freela de design', valorPadraoCentavos: 150_000 })

    const primeiro = repo.criarAvulsoCompleto({
      rendaId: fonte.id,
      valorCentavos: 150_000,
      dataEsperada: '2026-08-10'
    })
    const segundo = repo.criarAvulsoCompleto({
      rendaId: fonte.id,
      valorCentavos: 120_000,
      dataEsperada: '2026-09-10'
    })

    // Duas entradas, uma fonte só — antes seriam três fontes no total.
    expect(contarRendas()).toBe(1)
    expect(primeiro.rendaId).toBe(fonte.id)
    expect(segundo.rendaId).toBe(fonte.id)
  })

  it('recusa rendaId inexistente em vez de gravar vínculo órfão', () => {
    expect(() =>
      repo.criarAvulsoCompleto({
        rendaId: 999,
        valorCentavos: 10_000,
        dataEsperada: '2026-08-10'
      })
    ).toThrow(/renda/i)

    expect(contarRendas()).toBe(0)
  })

  it('recusa rendaId de fonte recorrente: avulso não pendura em fonte recorrente', () => {
    const recorrente = rendas.criarRecorrente({
      nome: 'Bolsa PET',
      valorPadraoCentavos: 90_000,
      diaEsperado: 5,
      dataInicio: '2026-06-01'
    })

    expect(() =>
      repo.criarAvulsoCompleto({
        rendaId: recorrente.renda.id,
        valorCentavos: 10_000,
        dataEsperada: '2026-08-10'
      })
    ).toThrow(/avulsa/i)
  })

  it('marca como Recebido quando vem data de recebimento', () => {
    const recebimento = repo.criarAvulsoCompleto({
      nome: 'Venda',
      valorCentavos: 5_000,
      dataEsperada: '2026-08-10',
      dataRecebida: '2026-08-11'
    })

    expect(recebimento.status).toBe('Recebido')
    expect(recebimento.dataRecebida).toBe('2026-08-11')
  })

  it('não deixa fonte órfã se a criação do recebimento falhar', () => {
    // valorCentavos inválido explode em `criar`, depois do INSERT da renda:
    // a transação precisa desfazer os dois.
    expect(() =>
      repo.criarAvulsoCompleto({
        nome: 'Vai falhar',
        valorCentavos: 0,
        dataEsperada: '2026-08-10'
      })
    ).toThrow()

    expect(contarRendas()).toBe(0)
  })
})
