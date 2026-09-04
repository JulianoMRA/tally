import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Database } from '../../src/persistence/database'
import { openInMemoryDatabase } from '../../src/persistence/database'
import { runMigrations } from '../../src/persistence/migrations/runner'
import { executarManutencaoPeriodica, type ManutencaoPeriodicaDeps } from '../manutencao'

function abrirBanco(): Database {
  const db = openInMemoryDatabase()
  runMigrations(db)
  return db
}

/** Cartão + fatura Aberta com fechamento já vencido, pronta para RN-06. */
function inserirFaturaVencida(db: Database, mesReferencia: string): void {
  const cartaoId = Number(
    db
      .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?,?,?,?)')
      .run('Inter', 5, 12, '#000').lastInsertRowid
  )
  db.prepare(
    `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
     VALUES (?, ?, ?, ?, 'Aberta')`
  ).run(cartaoId, mesReferencia, `${mesReferencia}-05`, `${mesReferencia}-12`)
}

function statusDaFatura(db: Database): string {
  return (db.prepare('SELECT status FROM fatura').get() as { status: string }).status
}

describe('executarManutencaoPeriodica', () => {
  let deps: ManutencaoPeriodicaDeps
  let bancoAtual: Database | null
  let avisados: Database[]
  let falhas: unknown[]

  beforeEach(() => {
    bancoAtual = null
    avisados = []
    falhas = []
    deps = {
      obterBanco: () => bancoAtual,
      avisar: (database) => avisados.push(database),
      registrar: vi.fn(),
      registrarFalha: (err) => falhas.push(err),
      hoje: () => '2026-09-02'
    }
  })

  it('fecha fatura vencida e dispara os avisos', () => {
    const db = abrirBanco()
    inserirFaturaVencida(db, '2026-08')
    bancoAtual = db

    executarManutencaoPeriodica(deps)

    expect(statusDaFatura(db)).toBe('Fechada')
    expect(avisados).toEqual([db])
    expect(falhas).toEqual([])
    db.close()
  })

  /**
   * O bug que este teste tranca: o timer recebia a `Database` por parâmetro e
   * a guardava no closure. `reabrirBanco()` — que "Criar backup agora" e
   * "Restaurar backup" disparam — troca a conexão do módulo, mas o timer
   * seguia apontando para a antiga, já fechada. A partir dali toda execução
   * morria em "Database already closed", e como o `verificarAvisos` vem depois
   * do `fecharVencidas` no mesmo try, RN-06 E as notificações paravam juntas —
   * em silêncio, pelo resto da sessão.
   */
  it('usa a conexão viva depois de o banco ser fechado e reaberto', () => {
    const antiga = abrirBanco()
    bancoAtual = antiga

    // Estado depois de `fecharBanco()` + `reabrirBanco()`.
    antiga.close()
    const nova = abrirBanco()
    inserirFaturaVencida(nova, '2026-08')
    bancoAtual = nova

    executarManutencaoPeriodica(deps)

    expect(falhas).toEqual([])
    expect(statusDaFatura(nova)).toBe('Fechada')
    expect(avisados).toEqual([nova])
    nova.close()
  })

  it('não faz nada quando ainda não há banco', () => {
    bancoAtual = null

    executarManutencaoPeriodica(deps)

    expect(avisados).toEqual([])
    expect(falhas).toEqual([])
  })

  it('entrega a falha a quem registra em vez de propagar', () => {
    const db = abrirBanco()
    db.close()
    bancoAtual = db

    expect(() => executarManutencaoPeriodica(deps)).not.toThrow()

    expect(falhas).toHaveLength(1)
    expect(String(falhas[0])).toContain('closed')
    expect(avisados).toEqual([])
  })

  it('registra quantas faturas fecharam, e só quando fechou alguma', () => {
    const db = abrirBanco()
    inserirFaturaVencida(db, '2026-08')
    bancoAtual = db

    executarManutencaoPeriodica(deps)
    expect(deps.registrar).toHaveBeenCalledTimes(1)

    // Segunda passada: a fatura já está Fechada, nada a registrar.
    executarManutencaoPeriodica(deps)
    expect(deps.registrar).toHaveBeenCalledTimes(1)
    db.close()
  })
})
