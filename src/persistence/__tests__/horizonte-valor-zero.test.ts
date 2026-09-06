import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { VisaoMensalRepository } from '../repositories/visao-mensal-repository'
import { proxMesReferencia } from '../../domain/services/mes-referencia'

/**
 * Valor zero é possível no banco e derrubava a Visão mensal de todo mês futuro.
 *
 * As três colunas de dinheiro têm `CHECK (... >= 0)`, e o schema do
 * export/import (`shared/ipc/dados.ts`) valida centavos com `int().min(0)` —
 * um backup restaurado pode trazer zero, ainda que nenhum formulário o aceite
 * (todos exigem `min(1)`). Os geradores do domain, por outro lado, RECUSAM
 * valor <= 0, e a extensão preguiçosa de horizonte os chamava sem filtrar.
 *
 * O efeito era desproporcional à causa: `VisaoMensalRepository.detalhar`
 * chama a extensão antes de ler o mês, então uma única linha zerada — de uma
 * fonte que o usuário talvez nem use mais — impedia a tela principal de abrir
 * em QUALQUER mês futuro, com a mensagem crua do gerador.
 *
 * A guarda já existia em `RendaRepository.semearHorizonte`, com o comentário
 * que a explica; faltava nos dois caminhos que rodam a cada navegação.
 */
const HOJE = '2026-09-15T12:00:00Z'
const MES_ATUAL = '2026-09'

describe('extensão de horizonte com valor zero no banco', () => {
  let db: Database
  let mesFuturo: string

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(HOJE))
    db = openInMemoryDatabase()
    runMigrations(db)
    mesFuturo = proxMesReferencia(MES_ATUAL)
  })

  afterEach(() => {
    vi.useRealTimers()
    db.close()
  })

  function detalharMesFuturo(): ReturnType<VisaoMensalRepository['detalhar']> {
    return new VisaoMensalRepository(db).detalhar(mesFuturo)
  }

  it('renda recorrente zerada não impede a visão mensal de mês futuro', () => {
    db.prepare(
      `INSERT INTO renda (nome, tipo, valor_padrao_centavos, dia_esperado, ativa)
       VALUES ('Fonte zerada', 'Recorrente', 0, 10, 1)`
    ).run()
    // Sem um recebimento existente a extensão nem começa (não há de onde
    // continuar): é a fonte JÁ semeada que alcançava o gerador.
    db.prepare(
      `INSERT INTO recebimento (renda_id, valor_centavos, data_esperada, status)
       VALUES (1, 0, ?, 'Esperado')`
    ).run(`${MES_ATUAL}-10`)

    expect(() => detalharMesFuturo()).not.toThrow()
  })

  it('assinatura de cartão zerada não impede a visão mensal de mês futuro', () => {
    db.prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('C', 'Despesa', '#111')").run()
    db.prepare(
      "INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES ('X', 5, 12, '#222')"
    ).run()
    db.prepare(
      `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id,
                            valor_centavos, data_compra, ativa)
       VALUES ('Assinatura zerada', 1, 'Assinatura', 'Credito', 1, 0, '2026-01-10', 1)`
    ).run()
    db.prepare(
      `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
       VALUES (1, '2026-01', '2026-01-05', '2026-01-12', 'Aberta')`
    ).run()
    db.prepare(
      `INSERT INTO parcela (despesa_id, fatura_id, numero, total, valor_centavos,
                            data_referencia, status)
       VALUES (1, 1, 1, NULL, 0, '2026-01-01', 'Pendente')`
    ).run()

    expect(() => detalharMesFuturo()).not.toThrow()
  })

  it('recorrente sem cartão zerada não impede a visão mensal de mês futuro', () => {
    db.prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('C', 'Despesa', '#111')").run()
    db.prepare(
      `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id,
                            valor_centavos, data_compra, ativa, dia_cobranca, recorre_ate)
       VALUES ('Aluguel zerado', 1, 'Assinatura', 'Pix', NULL, 0, '2026-01-10', 1, 10, NULL)`
    ).run()
    db.prepare(
      `INSERT INTO parcela (despesa_id, fatura_id, numero, total, valor_centavos,
                            data_referencia, status)
       VALUES (1, NULL, 1, NULL, 0, '2026-01-10', 'Pendente')`
    ).run()

    expect(() => detalharMesFuturo()).not.toThrow()
  })

  it('a linha zerada é ignorada, não gerada com valor zero', () => {
    db.prepare(
      `INSERT INTO renda (nome, tipo, valor_padrao_centavos, dia_esperado, ativa)
       VALUES ('Fonte zerada', 'Recorrente', 0, 10, 1)`
    ).run()
    db.prepare(
      `INSERT INTO recebimento (renda_id, valor_centavos, data_esperada, status)
       VALUES (1, 0, ?, 'Esperado')`
    ).run(`${MES_ATUAL}-10`)

    detalharMesFuturo()

    const { total } = db
      .prepare('SELECT COUNT(*) AS total FROM recebimento WHERE renda_id = 1')
      .get() as { total: number }
    expect(total).toBe(1)
  })

  it('fonte saudável ao lado de uma zerada continua sendo estendida', () => {
    db.prepare(
      `INSERT INTO renda (nome, tipo, valor_padrao_centavos, dia_esperado, ativa)
       VALUES ('Fonte zerada', 'Recorrente', 0, 10, 1)`
    ).run()
    db.prepare(
      `INSERT INTO renda (nome, tipo, valor_padrao_centavos, dia_esperado, ativa)
       VALUES ('Bolsa PET', 'Recorrente', 70000, 10, 1)`
    ).run()
    db.prepare(
      `INSERT INTO recebimento (renda_id, valor_centavos, data_esperada, status)
       VALUES (1, 0, ?, 'Esperado')`
    ).run(`${MES_ATUAL}-10`)
    db.prepare(
      `INSERT INTO recebimento (renda_id, valor_centavos, data_esperada, status)
       VALUES (2, 70000, ?, 'Esperado')`
    ).run(`${MES_ATUAL}-10`)

    const detalhe = detalharMesFuturo()

    // A zerada some da conta; a saudável alcança o mês futuro.
    expect(detalhe.recebimentos).toHaveLength(1)
    expect(detalhe.recebimentos[0].valorCentavos).toBe(70000)
  })
})
