import type { Database } from '../database'
import type { Despesa, FormaPagamento, TipoDespesa } from '../../domain/entities/despesa'
import type { Fatura } from '../../domain/entities/fatura'
import type { Parcela, StatusParcela } from '../../domain/entities/parcela'
import type { Repository } from './types'
import { CartaoRepository } from './cartao-repository'
import { CategoriaRepository } from './categoria-repository'
import { FaturaRepository } from './fatura-repository'
import { ParcelaRepository } from './parcela-repository'
import { TagRepository } from './tag-repository'
import { mapDespesa, mapParcela, type DespesaRow, type ParcelaRow } from './row-mappers'
import { calcularExtensaoNecessaria } from '../../domain/services/calcular-extensao-horizonte'
import { gerarParcelas } from '../../domain/services/gerar-parcelas'
import {
  diferencaEmMeses,
  mesReferenciaParaData,
  proxMesReferencia
} from '../../domain/services/mes-referencia'
import type { GastoForaCartaoDoMes } from '../../shared/ipc/visao-mensal'
import {
  gerarOcorrenciasAPartirDoMes,
  gerarOcorrenciasAssinatura,
  gerarOcorrenciasSemCartao
} from '../../domain/services/gerar-ocorrencias-assinatura'
import { hojeIsoLocal, mesAtualReferencia } from '../../shared/datas-locais'
import { validarFaturaAceitaNovaParcela } from '../../domain/services/ciclo-fatura'
import {
  parcelasElegiveisParaRecalculo,
  podeDeletarDespesa,
  podeEditarDespesa,
  type ParcelaComStatusFatura
} from '../../domain/services/regras-despesa'
import { recalcularParcelasPendentes } from '../../domain/services/recalcular-parcelas'

const HORIZONTE_ASSINATURA_MESES = 12

/** Linha crua do JOIN parcela × despesa de `listarOcorrenciasDoMes`. */
export type OcorrenciaRow = {
  parcela_id: number
  numero: number
  total: number | null
  parcela_valor_centavos: number
  data_referencia: string
  mes_referencia: string
  status: StatusParcela
  despesa_id: number
  descricao: string
  categoria_id: number
  tipo: TipoDespesa
  forma_pagamento: FormaPagamento
  cartao_id: number | null
  despesa_valor_centavos: number
  total_parcelas: number | null
  data_compra: string
  nota: string | null
  ativa: 0 | 1
  menor_numero: number
}

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

/**
 * RF-DES-16 — recorrente FORA de cartao. Nao tem `dataInicio` nem `cartaoId`:
 * uma recorrente sem cartao nao tem data de compra, tem um mes em que comeca e
 * um dia em que acontece.
 */
export type CriarAssinaturaForaCartaoInput = {
  descricao: string
  categoriaId: number
  formaPagamento: FormaPagamentoForaCartao
  valorMensalCentavos: number
  /** Mes da primeira cobranca, "YYYY-MM". */
  mesInicial: string
  /** Dia do mes da cobranca, 1..31. */
  diaCobranca: number
  /** Data limite "YYYY-MM-DD"; null = recorre sempre. */
  recorreAte: string | null
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
    this.validarCategoria(input.categoriaId)

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
      this.exigirFaturaAceitaNovaParcela(fatura)

      const parcela = parcelaRepo.criar({
        despesaId: despesa.id,
        faturaId: fatura.id,
        numero: 1,
        total: 1,
        valorCentavos: input.valorCentavos,
        // Mês da fatura, não a data da compra. Parcelada e assinatura já
        // gravavam assim (via `gerarParcelas`); só a única no crédito guardava
        // a data da compra, e com isso uma compra feita depois do fechamento
        // ficava num mês pela parcela e em outro pela fatura.
        dataReferencia: mesReferenciaParaData(fatura.mesReferencia)
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
    this.validarCategoria(input.categoriaId)

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
        this.exigirFaturaAceitaNovaParcela(fatura)
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
    this.validarCategoria(input.categoriaId)

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
        this.exigirFaturaAceitaNovaParcela(fatura)
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
    this.validarCategoria(input.categoriaId)

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
        this.exigirFaturaAceitaNovaParcela(fatura)
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

  /**
   * RF-DES-16 — recorrente FORA de cartao (Pix, debito ou dinheiro).
   *
   * Espelha `criarAssinaturaCredito`, sem os dois passos que dependem de
   * cartao: nao consulta a RN-01 para achar o mes (o mes vem informado) e nao
   * cria fatura (`fatura_id` fica NULL). A `data_compra` guardada e a data da
   * PRIMEIRA ocorrencia — e o mais proximo de "quando isso comecou" que este
   * tipo tem —, enquanto o dia pedido vive em `dia_cobranca`, intacto do clamp.
   */
  criarAssinaturaForaCartao(input: CriarAssinaturaForaCartaoInput): ResultadoCriarAssinatura {
    const parcelaRepo = new ParcelaRepository(this.db)
    this.validarCategoria(input.categoriaId)

    const planejadas = gerarOcorrenciasSemCartao({
      mesReferenciaInicial: input.mesInicial,
      diaCobranca: input.diaCobranca,
      valorMensalCentavos: input.valorMensalCentavos,
      quantidade: HORIZONTE_ASSINATURA_MESES,
      recorreAte: input.recorreAte
    })

    if (planejadas.length === 0) {
      throw new Error(
        'A data limite e anterior a primeira cobranca: a recorrencia nao geraria nenhuma ocorrencia.'
      )
    }

    return this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id,
                                valor_centavos, total_parcelas, data_compra, dia_cobranca, recorre_ate)
           VALUES (?, ?, 'Assinatura', ?, NULL, ?, NULL, ?, ?, ?)`
        )
        .run(
          input.descricao,
          input.categoriaId,
          input.formaPagamento,
          input.valorMensalCentavos,
          planejadas[0].dataReferencia,
          input.diaCobranca,
          input.recorreAte
        )

      const despesaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(Number(info.lastInsertRowid)) as DespesaRow | undefined
      if (!despesaRow) throw new Error('Falha ao recuperar despesa apos criar')
      const despesa = mapDespesa(despesaRow)

      const parcelas: Parcela[] = []
      for (const o of planejadas) {
        parcelas.push(
          parcelaRepo.criar({
            despesaId: despesa.id,
            faturaId: null,
            numero: o.numero,
            total: o.total,
            valorCentavos: o.valorCentavos,
            dataReferencia: o.dataReferencia
          })
        )
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
      // Com cartao: parcelas em fatura Aberta sao canceladas; Fechada/Paga
      // preservam historico. Filtra tambem por parcela.status='Pendente'
      // (defense in depth — nao deveria existir parcela Paga em fatura Aberta,
      // mas se houver, preservar).
      //
      // SEM cartao (RF-DES-20) nao existe fatura para consultar, e o INNER JOIN
      // acima nao casaria com nada — cancelar seria um no-op silencioso. O
      // criterio equivalente e a DATA: ocorrencia com data ainda no futuro nao
      // aconteceu e pode sumir; a de ontem ja tirou dinheiro da conta e fica.
      // Note que aqui o corte e mais conservador que no ramo com cartao, onde a
      // fatura Aberta do mes corrente e cancelavel inteira: la nada saiu da
      // conta ainda, porque a fatura nao foi paga.
      const rowsParaCancelar = (
        despesaRow.cartao_id === null
          ? this.db
              .prepare(
                `SELECT p.* FROM parcela p
                 WHERE p.despesa_id = ? AND p.fatura_id IS NULL
                   AND p.status = 'Pendente' AND p.data_referencia > ?`
              )
              .all(despesaId, hojeIsoLocal())
          : this.db
              .prepare(
                `SELECT p.* FROM parcela p
                 INNER JOIN fatura f ON f.id = p.fatura_id
                 WHERE p.despesa_id = ? AND f.status = 'Aberta' AND p.status = 'Pendente'`
              )
              .all(despesaId)
      ) as ParcelaRow[]

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
      this.aplicarValorMensal(despesaId, novoValorCentavos)

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

  /**
   * Aplica o valor mensal INTEGRAL às ocorrências Pendentes de uma assinatura
   * que estejam em fatura Aberta. Ocorrências pagas ou em faturas Fechada/Paga
   * preservam o histórico. Base comum de `reajustarValorMensalAssinatura` e
   * `atualizarAssinatura`.
   */
  private aplicarValorMensal(despesaId: number, valorCentavos: number): void {
    // Duas clausulas, uma por ramo, na mesma instrucao. Sem a segunda, reajustar
    // uma recorrente sem cartao nao atualizaria nada e nao reclamaria — o
    // `fatura_id IN (...)` simplesmente nao casa com `fatura_id NULL`.
    // Ocorrencia sem cartao com data ja passada nao e tocada: ela ja saiu da
    // conta pelo valor antigo, e reescreve-la falsificaria o mes fechado.
    this.db
      .prepare(
        `UPDATE parcela
         SET valor_centavos = ?, updated_at = datetime('now')
         WHERE despesa_id = ?
           AND status = 'Pendente'
           AND (
             fatura_id IN (SELECT id FROM fatura WHERE status = 'Aberta')
             OR (fatura_id IS NULL AND data_referencia > ?)
           )`
      )
      .run(valorCentavos, despesaId, hojeIsoLocal())
  }

  private atualizarAssinatura(
    despesaId: number,
    despesaRow: DespesaRow,
    input: { descricao: string; categoriaId: number; valorCentavos: number }
  ): Despesa {
    const valorMudou = despesaRow.valor_centavos !== input.valorCentavos
    return this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE despesa
           SET descricao = ?, categoria_id = ?, valor_centavos = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .run(input.descricao, input.categoriaId, input.valorCentavos, despesaId)

      if (valorMudou) {
        this.aplicarValorMensal(despesaId, input.valorCentavos)
      }

      const atualizadaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(despesaId) as DespesaRow
      return mapDespesa(atualizadaRow)
    })()
  }

  criarUnicaForaCartao(input: CriarDespesaUnicaForaCartaoInput): ResultadoCriarUnicaForaCartao {
    const parcelaRepo = new ParcelaRepository(this.db)
    this.validarCategoria(input.categoriaId)

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

  /**
   * Bloco Saídas — lista despesas-mestre (1 linha por despesa) com filtros
   * opcionais. `tipo` mapeia as categorias da UI; `mesReferencia` só faz sentido
   * para gastos fora do cartão (data única) e é ignorado nos demais tipos.
   */
  /**
   * RF-DES-14 — ocorrências de um mês: uma linha por parcela, não por despesa.
   *
   * A lista de Saídas era o registro de tudo o que já foi cadastrado, sem
   * recorte, e por isso não tinha total somável nem coluna comparável entre
   * um parcelado, uma assinatura e um gasto único. Aqui cada linha é o que
   * aquela despesa custa NAQUELE mês.
   *
   * O recorte usa `fatura.mes_referencia` quando a parcela está em fatura, e
   * só cai em `parcela.data_referencia` para gasto fora do cartão, que não tem
   * fatura. Desde a migration 0010 as duas colunas concordam para parcela em
   * fatura; o `COALESCE` continua porque a fatura é a fonte de verdade do mês
   * de referência (RF-VIS-01) e porque gasto fora do cartão não tem nenhuma.
   *
   * `menor_numero` acompanha a linha porque é o que separa uma parcelada
   * criada do zero de uma criada em andamento — ver `descreverOcorrencia`.
   */
  listarOcorrenciasDoMes(mesReferencia: string): OcorrenciaRow[] {
    return this.db
      .prepare(
        `SELECT
           p.id                AS parcela_id,
           p.numero            AS numero,
           p.total             AS total,
           p.valor_centavos    AS parcela_valor_centavos,
           p.data_referencia   AS data_referencia,
           p.status            AS status,
           d.id                AS despesa_id,
           d.descricao         AS descricao,
           d.categoria_id      AS categoria_id,
           d.tipo              AS tipo,
           d.forma_pagamento   AS forma_pagamento,
           d.cartao_id         AS cartao_id,
           d.valor_centavos    AS despesa_valor_centavos,
           d.total_parcelas    AS total_parcelas,
           d.data_compra       AS data_compra,
           d.nota              AS nota,
           d.ativa             AS ativa,
           COALESCE(f.mes_referencia, substr(p.data_referencia, 1, 7)) AS mes_referencia,
           (SELECT MIN(numero) FROM parcela WHERE despesa_id = d.id) AS menor_numero
         FROM parcela p
         JOIN despesa d ON d.id = p.despesa_id
         LEFT JOIN fatura f ON f.id = p.fatura_id
         WHERE COALESCE(f.mes_referencia, substr(p.data_referencia, 1, 7)) = ?
         ORDER BY d.data_compra DESC, p.id DESC`
      )
      .all(mesReferencia) as OcorrenciaRow[]
  }

  listarDespesas(filtro?: {
    tipo?: 'foraCartao' | 'parcelada' | 'assinatura'
    apenasAtivas?: boolean
    mesReferencia?: string
  }): Despesa[] {
    const conds: string[] = []
    const params: string[] = []

    if (filtro?.tipo === 'foraCartao') {
      conds.push("tipo = 'Unica' AND forma_pagamento != 'Credito'")
    } else if (filtro?.tipo === 'parcelada') {
      conds.push("tipo = 'Parcelada'")
    } else if (filtro?.tipo === 'assinatura') {
      conds.push("tipo = 'Assinatura'")
    }
    if (filtro?.apenasAtivas) {
      conds.push('ativa = 1')
    }
    if (filtro?.mesReferencia && filtro?.tipo === 'foraCartao') {
      conds.push('substr(data_compra, 1, 7) = ?')
      params.push(filtro.mesReferencia)
    }

    let sql = 'SELECT * FROM despesa'
    if (conds.length > 0) sql += ` WHERE ${conds.join(' AND ')}`
    sql += ' ORDER BY ativa DESC, data_compra DESC, id DESC'

    const rows = this.db.prepare(sql).all(...params) as DespesaRow[]
    return rows.map(mapDespesa)
  }

  /**
   * Gastos fora de cartao do mes — a unidade e a OCORRENCIA, nao a despesa
   * (RN-08).
   *
   * A consulta era `FROM despesa WHERE tipo = 'Unica'` agrupada por
   * `substr(data_compra, 1, 7)`. Enquanto toda despesa fora de cartao era
   * Unica, uma despesa tinha exatamente uma parcela no mesmo mes e as duas
   * leituras davam o mesmo numero. A recorrente sem cartao (RF-DES-16) quebra a
   * equivalencia — uma despesa, N ocorrencias em N meses — e a leitura por
   * despesa passaria a contar a recorrente inteira no mes de inicio e nada nos
   * demais. O ranking de categorias, o orcamento e a lista de Saidas ja
   * contavam por parcela; esta consulta alinha a Visao mensal e a exportacao.
   *
   * **Sem filtro por `ativa`, de proposito.** Cancelar uma recorrente apaga as
   * ocorrencias futuras e marca a despesa como inativa; as passadas continuam
   * existindo porque aconteceram. Filtrar por `ativa = 1` as apagaria dos meses
   * ja encerrados, reescrevendo historico. O filtro existia na consulta antiga
   * e era inerte, porque nada marcava despesa Unica como inativa.
   */
  listarGastosForaCartao(filtro?: { mesReferencia?: string }): GastoForaCartaoDoMes[] {
    let sql = `SELECT p.id           AS id,
                      p.despesa_id   AS despesa_id,
                      p.numero       AS numero,
                      p.valor_centavos AS valor_centavos,
                      p.data_referencia AS data,
                      d.descricao    AS descricao,
                      d.categoria_id AS categoria_id,
                      d.forma_pagamento AS forma_pagamento,
                      d.tipo         AS tipo
               FROM parcela p
               JOIN despesa d ON d.id = p.despesa_id
               WHERE p.fatura_id IS NULL AND d.forma_pagamento != 'Credito'`
    const params: string[] = []
    if (filtro?.mesReferencia) {
      sql += ' AND substr(p.data_referencia, 1, 7) = ?'
      params.push(filtro.mesReferencia)
    }
    sql += ' ORDER BY p.data_referencia DESC, p.id DESC'

    type LinhaGasto = {
      id: number
      despesa_id: number
      numero: number
      valor_centavos: number
      data: string
      descricao: string
      categoria_id: number
      forma_pagamento: FormaPagamento
      tipo: TipoDespesa
    }

    return (this.db.prepare(sql).all(...params) as LinhaGasto[]).map((r) => ({
      id: r.id,
      despesaId: r.despesa_id,
      numero: r.numero,
      valorCentavos: r.valor_centavos,
      data: r.data,
      descricao: r.descricao,
      categoriaId: r.categoria_id,
      formaPagamento: r.forma_pagamento,
      tipo: r.tipo
    }))
  }

  /**
   * RF-DES-16 — estende o horizonte de uma recorrente SEM cartao ate `mesAlvo`.
   *
   * Devolve quantas ocorrencias criou. Para sozinha quando `recorre_ate` corta
   * antes do alvo (RF-DES-18), e nao gera nada quando ja esta coberta.
   */
  private estenderRecorrenteSemCartao(
    a: DespesaRow & { ultimo_mes: string | null; ultimo_numero: number | null },
    mesAlvo: string,
    parcelaRepo: ParcelaRepository
  ): number {
    // Recorrente sem dia de cobranca nao e gerable. Nao deveria existir — o
    // cadastro exige o dia —, mas um import de backup antigo poderia trazer.
    if (a.dia_cobranca === null) return 0

    const extensao = calcularExtensaoNecessaria({
      mesAlvo,
      ultimoMesExistente: a.ultimo_mes,
      ultimoNumeroExistente: a.ultimo_numero
    })
    if (!extensao) return 0

    const novas = gerarOcorrenciasSemCartao({
      mesReferenciaInicial: extensao.mesReferenciaInicial,
      diaCobranca: a.dia_cobranca,
      valorMensalCentavos: a.valor_centavos,
      quantidade: extensao.quantidade,
      ocorrenciaInicial: extensao.ocorrenciaInicial,
      recorreAte: a.recorre_ate
    })

    for (const o of novas) {
      parcelaRepo.criar({
        despesaId: a.id,
        faturaId: null,
        numero: o.numero,
        total: o.total,
        valorCentavos: o.valorCentavos,
        dataReferencia: o.dataReferencia
      })
    }
    return novas.length
  }

  /**
   * RF-DES-19 — altera a data limite de uma recorrente sem cartao.
   *
   * Encurtar apaga as ocorrencias futuras alem do novo limite; esticar (ou
   * voltar para "sempre", com `null`) regenera ate o horizonte de 12 meses.
   * Ocorrencia com data ja passada nunca e tocada.
   *
   * **A regeneracao tem um caso que so aparece depois de encurtar ao extremo:**
   * se o novo limite apagar TODAS as ocorrencias, `calcularExtensaoNecessaria`
   * nao tem de onde partir e devolve null — a recorrente ficaria ativa e esteril
   * para sempre, que e exatamente o defeito da fonte de renda desarquivada do
   * PR `#129`. Por isso, quando nao sobra ocorrencia nenhuma, a serie e semeada
   * de novo a partir do mes da `data_compra`, que e onde ela comecou.
   */
  atualizarLimiteRecorrencia(despesaId: number, recorreAte: string | null): Despesa {
    const despesaRow = this.db.prepare('SELECT * FROM despesa WHERE id = ?').get(despesaId) as
      | DespesaRow
      | undefined
    if (!despesaRow) throw new Error(`Despesa #${despesaId} nao encontrada`)
    if (despesaRow.tipo !== 'Assinatura' || despesaRow.cartao_id !== null) {
      throw new Error(`Despesa #${despesaId} nao e uma recorrente sem cartao`)
    }
    if (recorreAte !== null && !/^\d{4}-\d{2}-\d{2}$/.test(recorreAte)) {
      throw new Error(`recorreAte invalido: '${recorreAte}'. Esperado YYYY-MM-DD.`)
    }

    const parcelaRepo = new ParcelaRepository(this.db)

    return this.db.transaction(() => {
      this.db
        .prepare(`UPDATE despesa SET recorre_ate = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(recorreAte, despesaId)

      if (recorreAte !== null) {
        this.db
          .prepare(
            `DELETE FROM parcela
             WHERE despesa_id = ? AND fatura_id IS NULL AND status = 'Pendente'
               AND data_referencia > ? AND data_referencia > ?`
          )
          .run(despesaId, hojeIsoLocal(), recorreAte)
      }

      const atualizadaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(despesaId) as DespesaRow

      if (atualizadaRow.ativa === 1) {
        let mesAlvo = mesAtualReferencia()
        for (let i = 0; i < HORIZONTE_ASSINATURA_MESES - 1; i++) {
          mesAlvo = proxMesReferencia(mesAlvo)
        }
        this.sincronizarRecorrenteSemCartao(atualizadaRow, mesAlvo, parcelaRepo)
      }

      const finalRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(despesaId) as DespesaRow
      return mapDespesa(finalRow)
    })()
  }

  /**
   * Gera o que falta para a recorrente sem cartao alcancar `mesAlvo`, semeando
   * do zero quando nao sobrou ocorrencia nenhuma de onde continuar.
   */
  private sincronizarRecorrenteSemCartao(
    despesaRow: DespesaRow,
    mesAlvo: string,
    parcelaRepo: ParcelaRepository
  ): number {
    const agregado = this.db
      .prepare(
        `SELECT MAX(substr(data_referencia, 1, 7)) AS ultimo_mes,
                MAX(numero)                        AS ultimo_numero
         FROM parcela WHERE despesa_id = ? AND fatura_id IS NULL`
      )
      .get(despesaRow.id) as { ultimo_mes: string | null; ultimo_numero: number | null }

    if (agregado.ultimo_mes !== null) {
      return this.estenderRecorrenteSemCartao(
        { ...despesaRow, ultimo_mes: agregado.ultimo_mes, ultimo_numero: agregado.ultimo_numero },
        mesAlvo,
        parcelaRepo
      )
    }

    // Nenhuma ocorrencia sobrou: semeia de novo a partir do mes de inicio.
    if (despesaRow.dia_cobranca === null) return 0
    const mesInicial = despesaRow.data_compra.slice(0, 7)
    const quantidade = Math.max(1, diferencaEmMeses(mesInicial, mesAlvo) + 1)
    const novas = gerarOcorrenciasSemCartao({
      mesReferenciaInicial: mesInicial,
      diaCobranca: despesaRow.dia_cobranca,
      valorMensalCentavos: despesaRow.valor_centavos,
      quantidade,
      recorreAte: despesaRow.recorre_ate
    })
    for (const o of novas) {
      parcelaRepo.criar({
        despesaId: despesaRow.id,
        faturaId: null,
        numero: o.numero,
        total: o.total,
        valorCentavos: o.valorCentavos,
        dataReferencia: o.dataReferencia
      })
    }
    return novas.length
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

    const regra = podeDeletarDespesa(this.comStatusFatura(parcelas))
    if (!regra.ok) {
      if (regra.motivo === 'has-parcela-paga') {
        throw new Error(
          `Despesa #${despesaId} possui parcela(s) paga(s): ${regra.parcelasPagas.join(', ')}. Exclusão bloqueada.`
        )
      }
      throw new Error(
        `Despesa #${despesaId} possui parcela(s) em fatura fechada ou paga: ${regra.parcelasBloqueadas.join(', ')}. Exclusão bloqueada.`
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
   * Unica, Parcelada ou Assinatura. Para Unica, tambem aceita nova
   * `dataCompra` (move a parcela para a fatura calculada via RN-01).
   *
   * Se `valorCentavos` mudou:
   * - Unica: atualiza a unica parcela.
   * - Parcelada: distribui o novo valor entre as parcelas pendentes via
   *   `recalcularParcelasPendentes` (resto vai para a ultima). Bloqueia
   *   quando ha parcela paga.
   * - Assinatura: aplica o novo valor mensal INTEGRAL as ocorrencias
   *   pendentes em fatura Aberta (RN-04). `dataCompra` (inicio) e historica
   *   e nao muda; ocorrencias pagas sao apenas preservadas.
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
    this.validarCategoria(input.categoriaId)

    if (despesaRow.tipo === 'Assinatura') {
      return this.atualizarAssinatura(despesaId, despesaRow, input)
    }

    const parcelaRepo = new ParcelaRepository(this.db)
    const parcelas = parcelaRepo.listarPorDespesa(despesaId)
    const itens = this.comStatusFatura(parcelas)
    const regra = podeEditarDespesa(itens)
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

    // RN-06: somente parcelas em fatura Aberta (ou sem fatura) recebem
    // redistribuição de valor ou mudança de data.
    const elegiveis = parcelasElegiveisParaRecalculo(itens)

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
          const unica = parcelas[0]
          if (!unica || !elegiveis.has(unica.id)) {
            throw new Error(
              `Parcela da despesa #${despesaId} não está em fatura aberta. Edição de valor bloqueada.`
            )
          }
          this.db
            .prepare(
              `UPDATE parcela SET valor_centavos = ?, updated_at = datetime('now') WHERE despesa_id = ?`
            )
            .run(input.valorCentavos, despesaId)
        } else {
          // Parcelada
          const novas = recalcularParcelasPendentes(parcelas, input.valorCentavos, elegiveis)
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

      if (dataMudou && despesaRow.tipo === 'Unica') {
        const unica = parcelas[0]
        if (!unica || !elegiveis.has(unica.id)) {
          throw new Error(
            `Parcela da despesa #${despesaId} não está em fatura aberta. Edição de data bloqueada.`
          )
        }
        if (despesaRow.cartao_id !== null) {
          // Recalcula fatura de destino via RN-01
          const cartaoRepo = new CartaoRepository(this.db)
          const cartao = cartaoRepo.findById(despesaRow.cartao_id)
          if (!cartao) throw new Error(`Cartão #${despesaRow.cartao_id} não encontrado`)
          const faturaRepo = new FaturaRepository(this.db)
          const novaFatura = faturaRepo.upsertParaCompra(cartao, input.dataCompra!)
          this.exigirFaturaAceitaNovaParcela(novaFatura)
          // Move a única parcela para a fatura nova e realinha a referência ao
          // mês DELA — mesmo contrato da criação.
          this.db
            .prepare(
              `UPDATE parcela SET fatura_id = ?, data_referencia = ?, updated_at = datetime('now') WHERE despesa_id = ?`
            )
            .run(novaFatura.id, mesReferenciaParaData(novaFatura.mesReferencia), despesaId)
        } else {
          // Fora de cartão: mantém data_referencia da parcela alinhada à
          // data_compra (relatórios agrupam pela parcela, não pela despesa).
          this.db
            .prepare(
              `UPDATE parcela SET data_referencia = ?, updated_at = datetime('now') WHERE despesa_id = ?`
            )
            .run(input.dataCompra!, despesaId)
        }
      }

      const atualizadaRow = this.db
        .prepare('SELECT * FROM despesa WHERE id = ?')
        .get(despesaId) as DespesaRow
      return mapDespesa(atualizadaRow)
    })()
  }

  /**
   * RF-DES-13 — define a nota livre e o conjunto de tags de uma despesa em uma
   * transação. Nota vazia vira NULL. Não bloqueia por status de fatura: são
   * metadados, não afetam valores nem parcelas.
   */
  definirNotaETags(despesaId: number, input: { nota: string | null; tags: string[] }): Despesa {
    const existe = this.db.prepare('SELECT id FROM despesa WHERE id = ?').get(despesaId)
    if (!existe) throw new Error(`Despesa #${despesaId} não encontrada`)
    const nota = input.nota && input.nota.trim().length > 0 ? input.nota.trim() : null

    return this.db.transaction(() => {
      this.db
        .prepare(`UPDATE despesa SET nota = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(nota, despesaId)
      new TagRepository(this.db).sincronizarDespesa(despesaId, input.tags)
      const row = this.db.prepare('SELECT * FROM despesa WHERE id = ?').get(despesaId) as DespesaRow
      return mapDespesa(row)
    })()
  }

  listarAssinaturas(filtro?: { ativa?: boolean }): Despesa[] {
    let sql = "SELECT * FROM despesa WHERE tipo = 'Assinatura'"
    const params: number[] = []
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
                COALESCE(
                  (SELECT MAX(f.mes_referencia) FROM parcela p
                     INNER JOIN fatura f ON f.id = p.fatura_id
                     WHERE p.despesa_id = d.id),
                  -- Sem cartao nao ha fatura: o mes vem da propria ocorrencia.
                  -- Sem este ramo o ultimo_mes era NULL e a extensao devolvia
                  -- null, deixando a recorrente parada para sempre.
                  (SELECT MAX(substr(p.data_referencia, 1, 7)) FROM parcela p
                     WHERE p.despesa_id = d.id AND p.fatura_id IS NULL)
                ) AS ultimo_mes,
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
        if (a.cartao_id === null) {
          parcelasCriadas += this.estenderRecorrenteSemCartao(a, mesAlvo, parcelaRepo)
          continue
        }
        const cartao = cartaoRepo.findById(a.cartao_id)
        if (!cartao) continue

        const extensao = calcularExtensaoNecessaria({
          mesAlvo,
          ultimoMesExistente: a.ultimo_mes,
          ultimoNumeroExistente: a.ultimo_numero
        })
        if (!extensao) continue

        // `gerarOcorrenciasAPartirDoMes`, e nao `gerarOcorrenciasAssinatura`:
        // o mes de referencia ja veio do `calcularExtensaoNecessaria`, e
        // passa-lo como data de compra (`YYYY-MM-01`) fazia a RN-01 ser
        // reaplicada sobre ele. A RN-01 manda a compra feita NO dia de
        // fechamento para a fatura seguinte, entao com `diaFechamento = 1` a
        // serie inteira deslizava um mes — e o buraco era permanente, porque a
        // chamada seguinte ve o ultimo mes ja alem do alvo e nao gera nada.
        const novasOcorrencias = gerarOcorrenciasAPartirDoMes({
          mesReferenciaInicial: extensao.mesReferenciaInicial,
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

  /**
   * RF-FAT-04 — fatura Paga não aceita novas parcelas. Chamado nos fluxos
   * iniciados pelo usuário (criação e atualização de despesa);
   * estenderHorizonteAssinaturas fica de fora por ser geração automática.
   */
  private exigirFaturaAceitaNovaParcela(fatura: Fatura): void {
    const resultado = validarFaturaAceitaNovaParcela(fatura)
    if (!resultado.ok) throw new Error(resultado.erro)
  }

  /**
   * Valida a existência da categoria antes do INSERT/UPDATE — a FK RESTRICT
   * pegaria de qualquer forma, mas com "FOREIGN KEY constraint failed" em vez
   * de uma mensagem acionável.
   */
  private validarCategoria(categoriaId: number): void {
    const categoria = new CategoriaRepository(this.db).findById(categoriaId)
    if (!categoria) throw new Error(`Categoria #${categoriaId} não encontrada`)
  }

  /** Anexa o status da fatura de cada parcela (null para fora de cartão). */
  private comStatusFatura(parcelas: readonly Parcela[]): ParcelaComStatusFatura[] {
    const faturaRepo = new FaturaRepository(this.db)
    const idsFatura = [
      ...new Set(parcelas.map((p) => p.faturaId).filter((id): id is number => id !== null))
    ]
    const statusPorId = faturaRepo.statusPorIds(idsFatura)
    return parcelas.map((parcela) => ({
      parcela,
      statusFatura: parcela.faturaId === null ? null : (statusPorId.get(parcela.faturaId) ?? null)
    }))
  }
}
