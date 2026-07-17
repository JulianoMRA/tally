import type { Database } from './database'
import { formatarValorCsv } from '../shared/csv/gerar-csv'
import { CategoriaRepository } from './repositories/categoria-repository'
import { DespesaRepository } from './repositories/despesa-repository'
import { ParcelaRepository } from './repositories/parcela-repository'
import { VisaoMensalRepository } from './repositories/visao-mensal-repository'

export type TabelaExportacao = {
  header: string[]
  linhas: string[][]
}

const HEADER = ['tipo', 'descricao', 'detalhe', 'categoria', 'cartao', 'data', 'valor', 'status']

/**
 * Tabela achatada com o movimento do mês para análise em planilha: parcelas
 * das faturas do mês (uma linha por parcela, com numeração), gastos fora de
 * cartão e recebimentos. Leitura pura — reusa `detalharSomenteLeitura` para
 * não disparar manutenção (fechamento/horizonte) num caminho de exportação.
 */
export function montarLinhasDoMes(db: Database, mesReferencia: string): TabelaExportacao {
  const detalhe = new VisaoMensalRepository(db).detalharSomenteLeitura(mesReferencia)
  const parcelaRepo = new ParcelaRepository(db)
  const despesaRepo = new DespesaRepository(db)
  const nomesCategoria = new Map(
    new CategoriaRepository(db).list({ incluirArquivados: true }).map((c) => [c.id, c.nome])
  )

  const linhas: string[][] = []

  for (const resumo of detalhe.faturas) {
    const parcelas = parcelaRepo.listarPorFatura(resumo.fatura.id)
    const despesas = new Map(
      despesaRepo.listarPorIds([...new Set(parcelas.map((p) => p.despesaId))]).map((d) => [d.id, d])
    )
    for (const parcela of parcelas) {
      const despesa = despesas.get(parcela.despesaId)
      const rotuloParcela =
        parcela.total === null ? 'assinatura' : `parcela ${parcela.numero}/${parcela.total}`
      linhas.push([
        'Fatura',
        despesa?.descricao ?? `despesa #${parcela.despesaId}`,
        rotuloParcela,
        despesa ? (nomesCategoria.get(despesa.categoriaId) ?? '') : '',
        resumo.cartaoNome,
        parcela.dataReferencia,
        formatarValorCsv(parcela.valorCentavos),
        parcela.status
      ])
    }
  }

  for (const gasto of detalhe.gastosForaCartao) {
    linhas.push([
      'Gasto fora de cartão',
      gasto.descricao,
      gasto.formaPagamento,
      nomesCategoria.get(gasto.categoriaId) ?? '',
      '',
      gasto.dataCompra,
      formatarValorCsv(gasto.valorCentavos),
      ''
    ])
  }

  for (const recebimento of detalhe.recebimentos) {
    linhas.push([
      'Recebimento',
      recebimento.rendaNome ?? 'Avulso',
      '',
      '',
      '',
      recebimento.dataEsperada,
      formatarValorCsv(recebimento.valorCentavos),
      recebimento.status
    ])
  }

  return { header: [...HEADER], linhas }
}
