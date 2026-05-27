import type { Database } from '../database'
import type { Despesa } from '../../domain/entities/despesa'
import type { Fatura } from '../../domain/entities/fatura'
import type { Parcela } from '../../domain/entities/parcela'
import type { Repository } from './types'
import { CartaoRepository } from './cartao-repository'
import { FaturaRepository } from './fatura-repository'
import { ParcelaRepository } from './parcela-repository'
import { mapDespesa, mapParcela, type DespesaRow, type ParcelaRow } from './row-mappers'
import { calcularExtensaoNecessaria } from '../../domain/services/calcular-extensao-horizonte'
import { gerarParcelas } from '../../domain/services/gerar-parcelas'
import { gerarOcorrenciasAssinatura } from '../../domain/services/gerar-ocorrencias-assinatura'
import { podeDeletarDespesa, podeEditarDespesa } from '../../domain/services/regras-despesa'
import { recalcularParcelasPendentes } from '../../domain/services/recalcular-parcelas'

const HORIZONTE_ASSINATURA_MESES = 12

export type CriarDespesaUnicaCreditoInput = {
  descricao: string
  categoriaId: number
  cartaoId: number
  valorCentavos: number
  dataCompra: string
}

export type ResultadoCriarDespesa = {
  despesa: Despesa
  fatura: Fatura
  parcela: Parcela
}

export type FormaPagamentoForaCartao = 'Debito' | 'Pix' | 'Dinheiro'

export type CriarDespesaUnicaForaCartaoInput = {
  descricao: string
  categoriaId: number
  formaPagamento: FormaPagamentoForaCartao
  valorCentavos: number
  dataCompra: string
}

export type ResultadoCriarUnicaForaCartao = {
  despesa: Despesa
  parcela: Parcela
}

export type CriarDespesaParceladaCreditoInput = {
  descricao: string
  categoriaId: number
  cartaoId: number
  totalParcelas: number
  valorTotalCentavos: number
  dataCompra: string
}

export type ResultadoCriarParcelada = {
  despesa: Despesa
  parcelas: Parcela[]
}

export type CriarDespesaEmAndamentoInput = {
  descricao: string
  categoriaId: number
  cartaoId: number
  totalParcelas: number
  parcelaAtual: number
  valorRestanteCentavos: number
  dataCompra: string
}

export type CriarAssinaturaCreditoInput = {
  descricao: string
  categoriaId: number
  cartaoId: number
  valorMensalCentavos: number
  dataInicio: string
}

export type ResultadoCriarAssinatura = {
  despesa: Despesa
  parcelas: Parcela[]
}

export type ResultadoCancelarAssinatura = {
  despesa: Despesa
  canceladas: Parcela[]
}

export type ResultadoReajusteAssinatura = {
  despesa: Despesa
  atualizadas: Parcela[]
}

export class DespesaRepository implements Repository {
  constructor(public readonly db: Database) {}

  criarUnicaCredito(input: CriarDespesaUnicaCreditoInput): ResultadoCriarDespesa {
    const cartaoRepo = new CartaoRepository(this.db)
    const faturaRepo = new FaturaRepository(this.db)
    const parcelaRepo = new ParcelaRepository(this.db)

    const cartao = cartaoRepo.findById(input.cartaoId)
    if (!cartao) throw new Error(`Cartão #${input.cartaoId} não encontrado`)

    return this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
           VALUES (?, ?, 'Unica', 'Credito', ?, ?, 1, ?)`
        )
        .run(
          input.descricao,
          input.categoriaId,
          input.cartaoId,
          input.valorCentavos,
          input.dataCompra
        )

      const despesaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(Number(info.lastInsertRowid)) as DespesaRow | undefined
      if (!despesaRow) throw new Error('Falha ao recuperar despesa após criar')
      const despesa = mapDespesa(despesaRow)

      const fatura = faturaRepo.upsertParaCompra(cartao, input.dataCompra)

      const parcela = parcelaRepo.criar({
        despesaId: despesa.id,
        faturaId: fatura.id,
        numero: 1,
        total: 1,
        valorCentavos: input.valorCentavos,
        dataReferencia: input.dataCompra
      })

      return { despesa, fatura, parcela }
    })()
  }

  criarParceladaCredito(input: CriarDespesaParceladaCreditoInput): ResultadoCriarParcelada {
    const cartaoRepo = new CartaoRepository(this.db)
    const faturaRepo = new FaturaRepository(this.db)
    const parcelaRepo = new ParcelaRepository(this.db)

    const cartao = cartaoRepo.findById(input.cartaoId)
    if (!cartao) throw new Error(`Cartão #${input.cartaoId} não encontrado`)

    const planejadas = gerarParcelas({
      cartao,
      dataCompra: input.dataCompra,
      totalParcelas: input.totalParcelas,
      valorTotalCentavos: input.valorTotalCentavos
    })

    return this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
           VALUES (?, ?, 'Parcelada', 'Credito', ?, ?, ?, ?)`
        )
        .run(
          input.descricao,
          input.categoriaId,
          input.cartaoId,
          input.valorTotalCentavos,
          input.totalParcelas,
          input.dataCompra
        )

      const despesaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(Number(info.lastInsertRowid)) as DespesaRow | undefined
      if (!despesaRow) throw new Error('Falha ao recuperar despesa após criar')
      const despesa = mapDespesa(despesaRow)

      const parcelas: Parcela[] = []
      for (const p of planejadas) {
        const fatura = faturaRepo.upsertParaMesReferencia(cartao, p.dataReferencia.slice(0, 7))
        const parcela = parcelaRepo.criar({
          despesaId: despesa.id,
          faturaId: fatura.id,
          numero: p.numero,
          total: p.total,
          valorCentavos: p.valorCentavos,
          dataReferencia: p.dataReferencia
        })
        parcelas.push(parcela)
      }

      return { despesa, parcelas }
    })()
  }

  criarParceladaEmAndamento(input: CriarDespesaEmAndamentoInput): ResultadoCriarParcelada {
    const cartaoRepo = new CartaoRepository(this.db)
    const faturaRepo = new FaturaRepository(this.db)
    const parcelaRepo = new ParcelaRepository(this.db)

    const cartao = cartaoRepo.findById(input.cartaoId)
    if (!cartao) throw new Error(`Cartão #${input.cartaoId} não encontrado`)

    const planejadas = gerarParcelas({
      cartao,
      dataCompra: input.dataCompra,
      totalParcelas: input.totalParcelas,
      parcelaInicial: input.parcelaAtual,
      valorTotalCentavos: input.valorRestanteCentavos
    })

    return this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
           VALUES (?, ?, 'Parcelada', 'Credito', ?, ?, ?, ?)`
        )
        .run(
          input.descricao,
          input.categoriaId,
          input.cartaoId,
          input.valorRestanteCentavos,
          input.totalParcelas,
          input.dataCompra
        )

      const despesaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(Number(info.lastInsertRowid)) as DespesaRow | undefined
      if (!despesaRow) throw new Error('Falha ao recuperar despesa após criar')
      const despesa = mapDespesa(despesaRow)

      const parcelas: Parcela[] = []
      for (const p of planejadas) {
        const fatura = faturaRepo.upsertParaMesReferencia(cartao, p.dataReferencia.slice(0, 7))
        const parcela = parcelaRepo.criar({
          despesaId: despesa.id,
          faturaId: fatura.id,
          numero: p.numero,
          total: p.total,
          valorCentavos: p.valorCentavos,
          dataReferencia: p.dataReferencia
        })
        parcelas.push(parcela)
      }

      return { despesa, parcelas }
    })()
  }

  criarAssinaturaCredito(input: CriarAssinaturaCreditoInput): ResultadoCriarAssinatura {
    const cartaoRepo = new CartaoRepository(this.db)
    const faturaRepo = new FaturaRepository(this.db)
    const parcelaRepo = new ParcelaRepository(this.db)

    const cartao = cartaoRepo.findById(input.cartaoId)
    if (!cartao) throw new Error(`Cartão #${input.cartaoId} não encontrado`)

    const planejadas = gerarOcorrenciasAssinatura({
      cartao,
      dataInicio: input.dataInicio,
      valorMensalCentavos: input.valorMensalCentavos,
      quantidade: HORIZONTE_ASSINATURA_MESES
    })

    return this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
           VALUES (?, ?, 'Assinatura', 'Credito', ?, ?, NULL, ?)`
        )
        .run(
          input.descricao,
          input.categoriaId,
          input.cartaoId,
          input.valorMensalCentavos,
          input.dataInicio
        )

      const despesaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(Number(info.lastInsertRowid)) as DespesaRow | undefined
      if (!despesaRow) throw new Error('Falha ao recuperar despesa após criar')
      const despesa = mapDespesa(despesaRow)

      const parcelas: Parcela[] = []
      for (const o of planejadas) {
        const fatura = faturaRepo.upsertParaMesReferencia(cartao, o.dataReferencia.slice(0, 7))
        const parcela = parcelaRepo.criar({
          despesaId: despesa.id,
          faturaId: fatura.id,
          numero: o.numero,
          total: o.total,
          valorCentavos: o.valorCentavos,
          dataReferencia: o.dataReferencia
        })
        parcelas.push(parcela)
      }

      return { despesa, parcelas }
    })()
  }

  cancelarAssinatura(despesaId: number): ResultadoCancelarAssinatura {
    const despesaRow = this.db.prepare('SELECT * FROM despesa WHERE id = ?').get(despesaId) as
      | DespesaRow
      | undefined
    if (!despesaRow) throw new Error(`Despesa #${despesaId} não encontrada`)
    if (despesaRow.tipo !== 'Assinatura') {
      throw new Error(`Despesa #${despesaId} não é uma assinatura (tipo=${despesaRow.tipo})`)
    }

    return this.db.transaction(() => {
      // RN: parcelas em fatura Aberta são canceladas; Fechada/Paga preservam histórico.
      // Filtra também por parcela.status='Pendente' (defense in depth — não deveria
      // existir parcela Paga em fatura Aberta, mas se houver, preservar).
      const rowsParaCancelar = this.db
        .prepare(
          `SELECT p.* FROM parcela p
           INNER JOIN fatura f ON f.id = p.fatura_id
           WHERE p.despesa_id = ? AND f.status = 'Aberta' AND p.status = 'Pendente'`
        )
        .all(despesaId) as ParcelaRow[]

      const del = this.db.prepare('DELETE FROM parcela WHERE id = ?')
      const canceladas: Parcela[] = []
      for (const row of rowsParaCancelar) {
        del.run(row.id)
        canceladas.push(mapParcela(row))
      }

      this.db
        .prepare(`UPDATE despesa SET ativa = 0, updated_at = datetime('now') WHERE id = ?`)
        .run(despesaId)

      const atualizada = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(despesaId) as DespesaRow
      return { despesa: mapDespesa(atualizada), canceladas }
    })()
  }

  reajustarValorMensalAssinatura(
    despesaId: number,
    novoValorCentavos: number
  ): ResultadoReajusteAssinatura {
    if (!Number.isInteger(novoValorCentavos) || novoValorCentavos <= 0) {
      throw new Error(`novoValorCentavos deve ser inteiro > 0, recebido: ${novoValorCentavos}`)
    }

    const despesaRow = this.db.prepare('SELECT * FROM despesa WHERE id = ?').get(despesaId) as
      | DespesaRow
      | undefined
    if (!despesaRow) throw new Error(`Despesa #${despesaId} não encontrada`)
    if (despesaRow.tipo !== 'Assinatura') {
      throw new Error(`Despesa #${despesaId} não é uma assinatura (tipo=${despesaRow.tipo})`)
    }

    const parcelaRepo = new ParcelaRepository(this.db)

    return this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE parcela
           SET valor_centavos = ?, updated_at = datetime('now')
           WHERE despesa_id = ?
             AND status = 'Pendente'
             AND fatura_id IN (SELECT id FROM fatura WHERE status = 'Aberta')`
        )
        .run(novoValorCentavos, despesaId)

      this.db
        .prepare(`UPDATE despesa SET valor_centavos = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(novoValorCentavos, despesaId)

      const atualizadaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(despesaId) as DespesaRow
      const todasParcelas = parcelaRepo.listarPorDespesa(despesaId)
      const atualizadas = todasParcelas.filter((p) => p.valorCentavos === novoValorCentavos)

      return { despesa: mapDespesa(atualizadaRow), atualizadas }
    })()
  }

  criarUnicaForaCartao(input: CriarDespesaUnicaForaCartaoInput): ResultadoCriarUnicaForaCartao {
    const parcelaRepo = new ParcelaRepository(this.db)

    return this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
           VALUES (?, ?, 'Unica', ?, NULL, ?, 1, ?)`
        )
        .run(
          input.descricao,
          input.categoriaId,
          input.formaPagamento,
          input.valorCentavos,
          input.dataCompra
        )

      const despesaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(Number(info.lastInsertRowid)) as DespesaRow | undefined
      if (!despesaRow) throw new Error('Falha ao recuperar despesa após criar')
      const despesa = mapDespesa(despesaRow)

      const parcela = parcelaRepo.criar({
        despesaId: despesa.id,
        faturaId: null,
        numero: 1,
        total: 1,
        valorCentavos: input.valorCentavos,
        dataReferencia: input.dataCompra
      })

      return { despesa, parcela }
    })()
  }

  listarPorIds(ids: number[]): Despesa[] {
    if (ids.length === 0) return []
    const placeholders = ids.map(() => '?').join(',')
    const rows = this.db
      .prepare(`SELECT * FROM despesa WHERE id IN (${placeholders})`)
      .all(...ids) as DespesaRow[]
    return rows.map(mapDespesa)
  }

  listarGastosForaCartao(filtro?: { mesReferencia?: string }): Despesa[] {
    let sql =
      "SELECT * FROM despesa WHERE tipo = 'Unica' AND forma_pagamento != 'Credito' AND ativa = 1"
    const params: unknown[] = []
    if (filtro?.mesReferencia) {
      sql += ' AND substr(data_compra, 1, 7) = ?'
      params.push(filtro.mesReferencia)
    }
    sql += ' ORDER BY data_compra DESC, id DESC'
    const rows = this.db.prepare(sql).all(...params) as DespesaRow[]
    return rows.map(mapDespesa)
  }

  /**
   * RF-DES-09 — exclui despesa e suas parcelas pendentes em uma única
   * transação. Bloqueia quando há parcela Paga (regra em
   * `podeDeletarDespesa`). FKs são `ON DELETE RESTRICT`, por isso parcelas
   * são apagadas antes da despesa.
   */
  excluir(despesaId: number): { despesaExcluida: number; parcelasExcluidas: number } {
    const despesaRow = this.db.prepare('SELECT * FROM despesa WHERE id = ?').get(despesaId) as
      | DespesaRow
      | undefined
    if (!despesaRow) throw new Error(`Despesa #${despesaId} não encontrada`)

    const parcelaRepo = new ParcelaRepository(this.db)
    const parcelas = parcelaRepo.listarPorDespesa(despesaId)

    const regra = podeDeletarDespesa(parcelas)
    if (!regra.ok) {
      throw new Error(
        `Despesa #${despesaId} possui parcela(s) paga(s): ${regra.parcelasPagas.join(', ')}. Exclusão bloqueada.`
      )
    }

    return this.db.transaction(() => {
      const delParcelas = this.db.prepare('DELETE FROM parcela WHERE despesa_id = ?')
      const infoP = delParcelas.run(despesaId)

      this.db.prepare('DELETE FROM despesa WHERE id = ?').run(despesaId)

      return {
        despesaExcluida: despesaId,
        parcelasExcluidas: Number(infoP.changes)
      }
    })()
  }

  /**
   * RF-DES-10 — atualiza descricao, categoria e valor de uma despesa
   * Unica ou Parcelada. Para Unica, tambem aceita nova `dataCompra` (move
   * a parcela para a fatura calculada via RN-01). Bloqueia quando ha
   * parcela paga.
   *
   * Se `valorCentavos` mudou:
   * - Unica: atualiza a unica parcela.
   * - Parcelada: distribui o novo valor entre as parcelas pendentes via
   *   `recalcularParcelasPendentes` (resto vai para a ultima).
   *
   * Assinatura nao usa este metodo — usar `reajustarValorMensalAssinatura`.
   */
  atualizar(
    despesaId: number,
    input: {
      descricao: string
      categoriaId: number
      valorCentavos: number
      dataCompra?: string
    }
  ): Despesa {
    const despesaRow = this.db.prepare('SELECT * FROM despesa WHERE id = ?').get(despesaId) as
      | DespesaRow
      | undefined
    if (!despesaRow) throw new Error(`Despesa #${despesaId} não encontrada`)
    if (despesaRow.tipo === 'Assinatura') {
      throw new Error(`Use reajustarValorMensalAssinatura para assinaturas.`)
    }

    const parcelaRepo = new ParcelaRepository(this.db)
    const parcelas = parcelaRepo.listarPorDespesa(despesaId)
    const regra = podeEditarDespesa(parcelas)
    if (!regra.ok) {
      throw new Error(
        `Despesa #${despesaId} possui parcela(s) paga(s): ${regra.parcelasPagas.join(', ')}. Edição bloqueada.`
      )
    }

    const valorMudou = despesaRow.valor_centavos !== input.valorCentavos
    const dataMudou = input.dataCompra !== undefined && input.dataCompra !== despesaRow.data_compra

    if (dataMudou && despesaRow.tipo === 'Parcelada') {
      throw new Error(
        `Edição de data não suportada para despesas Parceladas (exclua e recadastre).`
      )
    }

    return this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE despesa
           SET descricao = ?, categoria_id = ?, valor_centavos = ?, data_compra = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .run(
          input.descricao,
          input.categoriaId,
          input.valorCentavos,
          input.dataCompra ?? despesaRow.data_compra,
          despesaId
        )

      if (valorMudou) {
        if (despesaRow.tipo === 'Unica') {
          this.db
            .prepare(
              `UPDATE parcela SET valor_centavos = ?, updated_at = datetime('now') WHERE despesa_id = ?`
            )
            .run(input.valorCentavos, despesaId)
        } else {
          // Parcelada
          const novas = recalcularParcelasPendentes(parcelas, input.valorCentavos)
          const upd = this.db.prepare(
            `UPDATE parcela SET valor_centavos = ?, updated_at = datetime('now') WHERE id = ?`
          )
          for (let i = 0; i < novas.length; i++) {
            if (novas[i].valorCentavos !== parcelas[i].valorCentavos) {
              upd.run(novas[i].valorCentavos, novas[i].id)
            }
          }
        }
      }

      if (dataMudou && despesaRow.tipo === 'Unica' && despesaRow.cartao_id !== null) {
        // Recalcula fatura de destino via RN-01
        const cartaoRepo = new CartaoRepository(this.db)
        const cartao = cartaoRepo.findById(despesaRow.cartao_id)
        if (!cartao) throw new Error(`Cartão #${despesaRow.cartao_id} não encontrado`)
        const faturaRepo = new FaturaRepository(this.db)
        const novaFatura = faturaRepo.upsertParaCompra(cartao, input.dataCompra!)
        // Move a unica parcela — data_referencia sempre YYYY-MM-DD (Slice 15)
        this.db
          .prepare(
            `UPDATE parcela SET fatura_id = ?, data_referencia = ?, updated_at = datetime('now') WHERE despesa_id = ?`
          )
          .run(novaFatura.id, input.dataCompra!, despesaId)
      }

      const atualizadaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(despesaId) as DespesaRow
      return mapDespesa(atualizadaRow)
    })()
  }

  listarAssinaturas(filtro?: { ativa?: boolean }): Despesa[] {
    let sql = "SELECT * FROM despesa WHERE tipo = 'Assinatura'"
    const params: unknown[] = []
    if (filtro?.ativa !== undefined) {
      sql += ' AND ativa = ?'
      params.push(filtro.ativa ? 1 : 0)
    }
    sql += ' ORDER BY ativa DESC, descricao ASC'
    const rows = this.db.prepare(sql).all(...params) as DespesaRow[]
    return rows.map(mapDespesa)
  }

  /**
   * RF-VIS-04, RN-04 — estende preguiçosamente o horizonte de parcelas das
   * assinaturas ativas até alcançar `mesAlvo`. Idempotente: chamadas para
   * meses já cobertos são no-op. Não retroage.
   */
  estenderHorizonteAssinaturas(mesAlvo: string): {
    parcelasCriadas: number
    faturasCriadas: number
  } {
    const cartaoRepo = new CartaoRepository(this.db)
    const faturaRepo = new FaturaRepository(this.db)
    const parcelaRepo = new ParcelaRepository(this.db)

    type AssinaturaRow = DespesaRow & {
      ultimo_mes: string | null
      ultimo_numero: number | null
    }
    const assinaturas = this.db
      .prepare(
        `SELECT d.*,
                (SELECT MAX(f.mes_referencia) FROM parcela p
                   INNER JOIN fatura f ON f.id = p.fatura_id
                   WHERE p.despesa_id = d.id) AS ultimo_mes,
                (SELECT MAX(p.numero) FROM parcela p
                   WHERE p.despesa_id = d.id) AS ultimo_numero
         FROM despesa d
         WHERE d.tipo = 'Assinatura' AND d.ativa = 1`
      )
      .all() as AssinaturaRow[]

    return this.db.transaction(() => {
      let parcelasCriadas = 0
      let faturasCriadas = 0

      for (const a of assinaturas) {
        if (a.cartao_id === null) continue
        const cartao = cartaoRepo.findById(a.cartao_id)
        if (!cartao) continue

        const extensao = calcularExtensaoNecessaria({
          mesAlvo,
          ultimoMesExistente: a.ultimo_mes,
          ultimoNumeroExistente: a.ultimo_numero
        })
        if (!extensao) continue

        const novasOcorrencias = gerarOcorrenciasAssinatura({
          cartao,
          dataInicio: `${extensao.mesReferenciaInicial}-01`,
          valorMensalCentavos: a.valor_centavos,
          quantidade: extensao.quantidade,
          ocorrenciaInicial: extensao.ocorrenciaInicial
        })

        for (const o of novasOcorrencias) {
          const mesRef = o.dataReferencia.slice(0, 7)
          const existente = faturaRepo.findByCartaoEMesReferencia(cartao.id, mesRef)
          const fatura = faturaRepo.upsertParaMesReferencia(cartao, mesRef)
          if (!existente) faturasCriadas++
          parcelaRepo.criar({
            despesaId: a.id,
            faturaId: fatura.id,
            numero: o.numero,
            total: o.total,
            valorCentavos: o.valorCentavos,
            dataReferencia: o.dataReferencia
          })
          parcelasCriadas++
        }
      }

      return { parcelasCriadas, faturasCriadas }
    })()
  }
}
