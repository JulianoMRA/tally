import type { Database } from '../database'
import type { Repository } from './types'
import { gerarSerieMensal } from '../../domain/services/serie-mensal'
import { VisaoMensalRepository } from './visao-mensal-repository'

export type TotalPorCategoria = {
  categoriaId: number
  categoriaNome: string
  cor: string
  totalCentavos: number
}

export type PontoEvolucaoSaldo = {
  mes: string
  entradasCentavos: number
  saidasCentavos: number
  saldoCentavos: number
}

export type PontoEvolucaoCategoria = {
  mes: string
  totalCentavos: number
}

export class RelatorioRepository implements Repository {
  constructor(public readonly db: Database) {}

  /**
   * RF-VIS-06 — total gasto por categoria num mês de referência.
   * Combina parcelas em faturas do mês + gastos fora de cartão do mês
   * (parcela.fatura_id IS NULL, identificados por substr(data_referencia)).
   * Ordenado decrescente por total. Categorias arquivadas aparecem se
   * tiverem gastos no período.
   */
  totaisPorCategoriaEmMes(mesReferencia: string): TotalPorCategoria[] {
    type Row = {
      id: number
      nome: string
      cor: string
      total: number
    }
    const rows = this.db
      .prepare(
        `SELECT c.id, c.nome, c.cor, SUM(total_centavos) AS total
         FROM (
           SELECT d.categoria_id AS cat_id, p.valor_centavos AS total_centavos
           FROM parcela p
           INNER JOIN fatura f ON f.id = p.fatura_id
           INNER JOIN despesa d ON d.id = p.despesa_id
           WHERE f.mes_referencia = ?

           UNION ALL

           SELECT d.categoria_id AS cat_id, p.valor_centavos AS total_centavos
           FROM parcela p
           INNER JOIN despesa d ON d.id = p.despesa_id
           WHERE p.fatura_id IS NULL AND substr(p.data_referencia, 1, 7) = ?
         ) t
         INNER JOIN categoria c ON c.id = t.cat_id
         GROUP BY c.id, c.nome, c.cor
         ORDER BY total DESC`
      )
      .all(mesReferencia, mesReferencia) as Row[]

    return rows.map((r) => ({
      categoriaId: r.id,
      categoriaNome: r.nome,
      cor: r.cor,
      totalCentavos: r.total
    }))
  }

  /**
   * RF-VIS-05 — evolução do saldo nos últimos N meses.
   * Reusa VisaoMensalRepository.detalhar() para cada mês da série.
   * Retorna ordem cronológica crescente.
   */
  evolucaoSaldoMensal(mesFinal: string, meses: number): PontoEvolucaoSaldo[] {
    const visaoRepo = new VisaoMensalRepository(this.db)
    const serie = gerarSerieMensal(mesFinal, meses)
    return serie.map((mes) => {
      const detalhe = visaoRepo.detalhar(mes)
      const entradasCentavos = detalhe.totais.totalEntradasRecebidasCentavos
      const saidasCentavos = detalhe.totais.totalSaidasCentavos
      return {
        mes,
        entradasCentavos,
        saidasCentavos,
        saldoCentavos: detalhe.totais.saldoRealizadoCentavos
      }
    })
  }

  /**
   * RF-VIS-06 — evolução de UMA categoria nos últimos N meses. Soma parcelas
   * em faturas + gastos fora cartão filtrando por categoria_id. Meses sem
   * gastos vêm com 0.
   */
  evolucaoCategoriaMensal(
    categoriaId: number,
    mesFinal: string,
    meses: number
  ): PontoEvolucaoCategoria[] {
    type Row = { mes: string; total: number }
    const rows = this.db
      .prepare(
        `SELECT mes, SUM(total_centavos) AS total
         FROM (
           SELECT f.mes_referencia AS mes, p.valor_centavos AS total_centavos
           FROM parcela p
           INNER JOIN fatura f ON f.id = p.fatura_id
           INNER JOIN despesa d ON d.id = p.despesa_id
           WHERE d.categoria_id = ?

           UNION ALL

           SELECT substr(p.data_referencia, 1, 7) AS mes, p.valor_centavos AS total_centavos
           FROM parcela p
           INNER JOIN despesa d ON d.id = p.despesa_id
           WHERE p.fatura_id IS NULL AND d.categoria_id = ?
         )
         GROUP BY mes`
      )
      .all(categoriaId, categoriaId) as Row[]

    const totaisPorMes = new Map(rows.map((r) => [r.mes, r.total]))
    return gerarSerieMensal(mesFinal, meses).map((mes) => ({
      mes,
      totalCentavos: totaisPorMes.get(mes) ?? 0
    }))
  }
}
