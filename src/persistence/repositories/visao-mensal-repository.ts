import type { Database } from '../database'
import type { Cartao } from '../../domain/entities/cartao'
import type { FaturaResumida, VisaoMensalDetalhada } from '../../shared/ipc/visao-mensal'
import type { Repository } from './types'
import { calcularBalancoMensal } from '../../domain/services/calcular-balanco-mensal'
import { diferencaEmMeses } from '../../domain/services/mes-referencia'
import { hojeIsoLocal, mesAtualReferencia } from '../../shared/datas-locais'
import { DespesaRepository } from './despesa-repository'
import { FaturaRepository } from './fatura-repository'
import { ParcelaRepository } from './parcela-repository'
import { RecebimentoRepository } from './recebimento-repository'
import { RendaRepository } from './renda-repository'
import { mapCartao, mapFatura, type CartaoRow, type FaturaRow } from './row-mappers'

const HORIZONTE_PROJECAO_MAX_MESES = 24

export class VisaoMensalRepository implements Repository {
  constructor(public readonly db: Database) {}

  detalhar(mesReferencia: string): VisaoMensalDetalhada {
    // RN-06: auto-fechamento de faturas vencidas também ao consultar a visão
    // mensal — sem isso, só o boot do app fechava faturas e uma sessão longa
    // exibia faturas Abertas já vencidas.
    new FaturaRepository(this.db).fecharVencidas(hojeIsoLocal())
    this.estenderHorizonteSeNecessario(mesReferencia)

    const despesaRepo = new DespesaRepository(this.db)
    const parcelaRepo = new ParcelaRepository(this.db)
    const recebimentoRepo = new RecebimentoRepository(this.db)

    const faturaRows = this.db
      .prepare(
        'SELECT * FROM fatura WHERE mes_referencia = ? ORDER BY data_vencimento ASC, cartao_id ASC'
      )
      .all(mesReferencia) as FaturaRow[]

    const cartaoIds = [...new Set(faturaRows.map((r) => r.cartao_id))]
    const cartoesById = new Map<number, Cartao>()
    if (cartaoIds.length > 0) {
      const placeholders = cartaoIds.map(() => '?').join(',')
      const cartaoRows = this.db
        .prepare(`SELECT * FROM cartao WHERE id IN (${placeholders})`)
        .all(...cartaoIds) as CartaoRow[]
      for (const c of cartaoRows) cartoesById.set(c.id, mapCartao(c))
    }

    const faturas: FaturaResumida[] = faturaRows.map((row) => {
      const fatura = mapFatura(row)
      const cartao = cartoesById.get(fatura.cartaoId)
      const parcelas = parcelaRepo.listarPorFatura(fatura.id)
      const totalCentavos = parcelas.reduce((s, p) => s + p.valorCentavos, 0)

      return {
        fatura,
        cartaoNome: cartao?.nome ?? `#${fatura.cartaoId}`,
        cartaoCor: cartao?.cor ?? '#999',
        totalCentavos
      }
    })

    const gastosForaCartao = despesaRepo.listarGastosForaCartao({ mesReferencia })
    const recebimentos = recebimentoRepo.listar({ mesReferencia })

    const totalFaturasCentavos = faturas.reduce((s, f) => s + f.totalCentavos, 0)
    const totalGastosForaCartaoCentavos = gastosForaCartao.reduce((s, g) => s + g.valorCentavos, 0)
    const totalRecebidoCentavos = recebimentos
      .filter((r) => r.status === 'Recebido')
      .reduce((s, r) => s + r.valorCentavos, 0)
    const totalEsperadoCentavos = recebimentos
      .filter((r) => r.status === 'Esperado')
      .reduce((s, r) => s + r.valorCentavos, 0)

    const totais = calcularBalancoMensal({
      totalFaturasCentavos,
      totalGastosForaCartaoCentavos,
      totalRecebidoCentavos,
      totalEsperadoCentavos
    })

    return {
      mesReferencia,
      faturas,
      gastosForaCartao,
      recebimentos,
      totais
    }
  }

  /**
   * RF-VIS-04, RN-04 — dispara geração preguiçosa de parcelas de assinaturas
   * e recebimentos recorrentes até o `mesAlvo`, com cap defensivo de 24 meses
   * adiante do mês atual. Forward-only (não retroage).
   */
  private estenderHorizonteSeNecessario(mesAlvo: string): void {
    const hoje = mesAtualReferencia()
    const mesesAdiante = diferencaEmMeses(hoje, mesAlvo)
    if (mesesAdiante <= 0) return
    if (mesesAdiante > HORIZONTE_PROJECAO_MAX_MESES) return

    const despesaRepo = new DespesaRepository(this.db)
    const rendaRepo = new RendaRepository(this.db)
    despesaRepo.estenderHorizonteAssinaturas(mesAlvo)
    rendaRepo.estenderHorizonteRecorrentes(mesAlvo)
  }
}
