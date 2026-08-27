import type { Database } from './database'
import { CartaoRepository } from './repositories/cartao-repository'
import { CategoriaRepository } from './repositories/categoria-repository'
import { DespesaRepository } from './repositories/despesa-repository'
import { RendaRepository } from './repositories/renda-repository'
import { RecebimentoRepository } from './repositories/recebimento-repository'
import type { LinhaImportacao, ResultadoImportacao, TipoImportacao } from '../shared/ipc/importacao'

/** Mapa nome (case-insensitive, trimmed) → id, apenas registros ativos. */
function indexarPorNome(itens: { id: number; nome: string }[]): Map<string, number> {
  return new Map(itens.map((i) => [i.nome.trim().toLowerCase(), i.id]))
}

/**
 * Importa um lote de linhas de CSV em UMA transação (all-or-nothing):
 * qualquer linha inválida — categoria/cartão inexistente, fatura Paga
 * (RF-FAT-04), constraint do schema — reverte a importação inteira, com o
 * número da linha do ARQUIVO na mensagem (dados começam na linha 2, após o
 * header). Reusa os fluxos de criação existentes, então RN-01/RN-02/RN-04
 * e o bloqueio de fatura Paga valem automaticamente.
 */
export function importarLinhas(db: Database, linhas: LinhaImportacao[]): ResultadoImportacao {
  const despesaRepo = new DespesaRepository(db)
  const rendaRepo = new RendaRepository(db)
  const recebimentoRepo = new RecebimentoRepository(db)
  const categorias = indexarPorNome(new CategoriaRepository(db).list())
  const cartoes = indexarPorNome(new CartaoRepository(db).list())

  const resolver = (
    mapa: Map<string, number>,
    rotulo: 'categoria' | 'cartão',
    nome: string,
    linha: number
  ): number => {
    const id = mapa.get(nome.trim().toLowerCase())
    if (id === undefined) {
      throw new Error(
        `Linha ${linha}: ${rotulo} '${nome}' não encontrado(a) — cadastre antes ou corrija o nome.`
      )
    }
    return id
  }

  const importarLinha = (item: LinhaImportacao, numeroNoArquivo: number): void => {
    switch (item.tipo) {
      case 'gastoForaCartao':
        despesaRepo.criarUnicaForaCartao({
          descricao: item.descricao,
          categoriaId: resolver(categorias, 'categoria', item.categoriaNome, numeroNoArquivo),
          formaPagamento: item.formaPagamento,
          valorCentavos: item.valorCentavos,
          dataCompra: item.data
        })
        return
      case 'unicaCredito':
        despesaRepo.criarUnicaCredito({
          descricao: item.descricao,
          categoriaId: resolver(categorias, 'categoria', item.categoriaNome, numeroNoArquivo),
          cartaoId: resolver(cartoes, 'cartão', item.cartaoNome, numeroNoArquivo),
          valorCentavos: item.valorCentavos,
          dataCompra: item.data
        })
        return
      case 'parceladaEmAndamento':
        despesaRepo.criarParceladaEmAndamento({
          descricao: item.descricao,
          categoriaId: resolver(categorias, 'categoria', item.categoriaNome, numeroNoArquivo),
          cartaoId: resolver(cartoes, 'cartão', item.cartaoNome, numeroNoArquivo),
          totalParcelas: item.totalParcelas,
          parcelaAtual: item.parcelaAtual,
          valorRestanteCentavos: item.valorRestanteCentavos,
          dataCompra: item.dataCompra
        })
        return
      case 'assinatura':
        despesaRepo.criarAssinaturaCredito({
          descricao: item.descricao,
          categoriaId: resolver(categorias, 'categoria', item.categoriaNome, numeroNoArquivo),
          cartaoId: resolver(cartoes, 'cartão', item.cartaoNome, numeroNoArquivo),
          valorMensalCentavos: item.valorMensalCentavos,
          dataInicio: item.dataInicio
        })
        return
      case 'rendaRecorrente':
        rendaRepo.criarRecorrente({
          nome: item.nome,
          valorPadraoCentavos: item.valorCentavos,
          diaEsperado: item.diaEsperado,
          dataInicio: item.dataInicio
        })
        return
      case 'recebimentoAvulso':
        // A coluna do CSV continua se chamando `nome` — mexer nela invalidaria
        // os templates que o usuario ja baixou. O que mudou e o destino: era o
        // nome de uma fonte criada implicitamente, agora e a descricao da
        // propria entrada.
        recebimentoRepo.criarAvulso({
          descricao: item.nome,
          valorCentavos: item.valorCentavos,
          dataEsperada: item.dataEsperada,
          dataRecebida: item.dataRecebida ?? undefined
        })
        return
    }
  }

  return db.transaction((): ResultadoImportacao => {
    const porTipo: Partial<Record<TipoImportacao, number>> = {}
    linhas.forEach((item, i) => {
      try {
        importarLinha(item, i + 2)
      } catch (err) {
        if (err instanceof Error && /^Linha \d+:/.test(err.message)) throw err
        const motivo = err instanceof Error ? err.message : String(err)
        throw new Error(`Linha ${i + 2}: ${motivo}`)
      }
      porTipo[item.tipo] = (porTipo[item.tipo] ?? 0) + 1
    })
    return { inseridos: linhas.length, porTipo }
  })()
}
