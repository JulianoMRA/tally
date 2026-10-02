import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const mostradas: { title: string; body: string }[] = []

vi.mock('electron', () => ({
  Notification: Object.assign(
    class {
      private readonly opcoes: { title: string; body: string }
      constructor(opcoes: { title: string; body: string }) {
        this.opcoes = opcoes
      }
      show(): void {
        mostradas.push(this.opcoes)
      }
    },
    { isSupported: () => true }
  )
}))

const { openInMemoryDatabase } = await import('../../src/persistence/database')
const { runMigrations } = await import('../../src/persistence/migrations/runner')
const { verificarAvisos, avisosMemorizados } = await import('../avisos')
type Database = import('../../src/persistence/database').Database

/**
 * O dedup mantinha uma chave `tipo:id:data` por aviso disparado e nunca
 * limpava nada: a data no meio da chave garantia que a entrada de ontem jamais
 * voltasse a casar, então o conjunto só crescia enquanto o app ficasse aberto.
 * Vazamento lento — algumas entradas por dia —, mas sem teto e sem motivo.
 *
 * Guardar o dia do conjunto e esvaziá-lo na virada resolve as duas coisas: o
 * tamanho passa a ser o número de faturas em janela, e a chave deixa de
 * precisar carregar a data.
 */
describe('verificarAvisos', () => {
  let db: Database
  let dir: string
  let settingsPath: string

  function prepararFaturaPrestesAFechar(hoje: string): void {
    db.prepare(
      "INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES ('Inter', 5, 12, '#f60')"
    ).run()
    db.prepare("INSERT INTO categoria (nome, cor) VALUES ('C', '#111')").run()
    db.prepare(
      `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
       VALUES (1, '2026-09', ?, '2026-09-12', 'Aberta')`
    ).run(hoje)
    db.prepare(
      `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id,
                            valor_centavos, data_compra, ativa)
       VALUES ('Compra', 1, 'Unica', 'Credito', 1, 1000, '2026-09-01', 1)`
    ).run()
    db.prepare(
      `INSERT INTO parcela (despesa_id, fatura_id, numero, total, valor_centavos,
                            data_referencia, status)
       VALUES (1, 1, 1, 1, 1000, '2026-09-01', 'Pendente')`
    ).run()
  }

  beforeEach(() => {
    mostradas.length = 0
    dir = mkdtempSync(join(tmpdir(), 'tally-avisos-'))
    settingsPath = join(dir, 'settings.json')
    db = openInMemoryDatabase()
    runMigrations(db)
  })

  afterEach(() => {
    vi.useRealTimers()
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('avisa uma vez por dia e nao repete na mesma data', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-05T09:00:00'))
    prepararFaturaPrestesAFechar('2026-09-05')

    expect(verificarAvisos(db, settingsPath)).toBe(1)
    expect(verificarAvisos(db, settingsPath)).toBe(0)
    expect(mostradas).toHaveLength(1)
  })

  // Datas distintas das do teste acima de proposito: o conjunto de dedup e
  // estado de MODULO, compartilhado entre os testes do arquivo. Reusar o mesmo
  // dia faria este teste herdar a chave do anterior — e a virada de dia, que e
  // o que ele mede, e justamente o que limpa essa heranca.
  it('volta a avisar no dia seguinte sem acumular a chave do dia anterior', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-20T09:00:00'))
    prepararFaturaPrestesAFechar('2026-09-21')
    expect(verificarAvisos(db, settingsPath)).toBe(1)

    vi.setSystemTime(new Date('2026-09-21T09:00:00'))
    expect(verificarAvisos(db, settingsPath)).toBe(1)
    expect(verificarAvisos(db, settingsPath)).toBe(0)

    // O conjunto guarda apenas o que ainda vale hoje: uma fatura, um tipo.
    expect(avisosMemorizados()).toBe(1)
  })

  /**
   * RN-10 / RF-CFG-02 — a notificacao de vencimento existe para lembrar de
   * pagar. Fatura Fechada cujos pagamentos parciais ja cobrem o total nao tem o
   * que pagar, so o que marcar: "vence em 2 dias" seria o alarme falso que a
   * tela de Faturas deixou de dar.
   *
   * Dias proprios, pelo mesmo motivo dos testes acima: o dedup e estado de
   * modulo.
   */
  function prepararFaturaFechadaVencendo(vencimento: string, pagoParcialCentavos: number): void {
    prepararFaturaPrestesAFechar('2026-10-05')
    db.prepare("UPDATE fatura SET status = 'Fechada', data_vencimento = ? WHERE id = 1").run(
      vencimento
    )
    db.prepare(
      `INSERT INTO pagamento_parcial (fatura_id, valor_centavos, data_pagamento)
       VALUES (1, ?, '2026-10-01')`
    ).run(pagoParcialCentavos)
  }

  it('nao notifica o vencimento de fatura Fechada coberta pelos pagamentos parciais', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-10T09:00:00'))
    prepararFaturaFechadaVencendo('2026-10-12', 1000)

    expect(verificarAvisos(db, settingsPath)).toBe(0)
    expect(mostradas).toEqual([])
  })

  it('notifica o vencimento quando o pagamento parcial nao cobre a fatura', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T09:00:00'))
    prepararFaturaFechadaVencendo('2026-10-17', 600)

    expect(verificarAvisos(db, settingsPath)).toBe(1)
    expect(mostradas).toHaveLength(1)
    expect(mostradas[0].title).toBe('Fatura Inter vence em 2 dias')
  })
})
