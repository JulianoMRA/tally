import type { Database } from '../database'
import type { Cartao } from '../../domain/entities/cartao'
import type { Contribuidor } from '../../domain/entities/contribuidor'
import type { Fatura, StatusFatura } from '../../domain/entities/fatura'
import type {
  AjudaPendentePorContribuidor,
  FaturaResumida,
  VisaoMensalDetalhada
} from '../../shared/ipc/visao-mensal'
import type { Repository } from './types'
import { calcularBalancoMensal } from '../../domain/services/calcular-balanco-mensal'
import { diferencaEmMeses } from '../../domain/services/mes-referencia'
import { AjudaRepository } from './ajuda-repository'
import { DespesaRepository } from './despesa-repository'
import { ParcelaRepository } from './parcela-repository'
import { RecebimentoRepository } from './recebimento-repository'
import { RendaRepository } from './renda-repository'

const HORIZONTE_PROJECAO_MAX_MESES = 24

function mesAtualReferencia(): string {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
}

type FaturaRow = {
  id: number
  cartao_id: number
  mes_referencia: string
  data_fechamento: string
  data_vencimento: string
  status: 'Aberta' | 'Fechada' | 'Paga'
  data_pagamento: string | null
  created_at: string
  updated_at: string
}

type CartaoRow = {
  id: number
  nome: string
  dia_fechamento: number
  dia_vencimento: number
  cor: string
  ativo: 0 | 1
  created_at: string
  updated_at: string
}

type ContribuidorRow = {
  id: number
  nome: string
  contato: string | null
  ativo: 0 | 1
  created_at: string
  updated_at: string
}

function mapFatura(row: FaturaRow): Fatura {
  let status: StatusFatura
  if (row.status === 'Paga') status = { kind: 'Paga', pagaEm: row.data_pagamento ?? '' }
  else if (row.status === 'Fechada') status = { kind: 'Fechada' }
  else status = { kind: 'Aberta' }
  return {
    id: row.id,
    cartaoId: row.cartao_id,
    mesReferencia: row.mes_referencia,
    dataFechamento: row.data_fechamento,
    dataVencimento: row.data_vencimento,
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapCartao(row: CartaoRow): Cartao {
  return {
    id: row.id,
    nome: row.nome,
    diaFechamento: row.dia_fechamento,
    diaVencimento: row.dia_vencimento,
    cor: row.cor,
    ativo: row.ativo === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapContribuidor(row: ContribuidorRow): Contribuidor {
  return {
    id: row.id,
    nome: row.nome,
    contato: row.contato,
    ativo: row.ativo === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class VisaoMensalRepository implements Repository {
  constructor(public readonly db: Database) {}

  detalhar(mesReferencia: string): VisaoMensalDetalhada {
    this.estenderHorizonteSeNecessario(mesReferencia)

    const ajudaRepo = new AjudaRepository(this.db)
    const despesaRepo = new DespesaRepository(this.db)
    const parcelaRepo = new ParcelaRepository(this.db)
    const recebimentoRepo = new RecebimentoRepository(this.db)

    // Faturas do mês com cartão
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
      const totalBrutoCentavos = parcelas.reduce((s, p) => s + p.valorCentavos, 0)
      const { totalAjudasCentavos } = ajudaRepo.totaisPorFatura(fatura.id)
      const totalLiquidoCentavos = totalBrutoCentavos - totalAjudasCentavos

      return {
        fatura,
        cartaoNome: cartao?.nome ?? `#${fatura.cartaoId}`,
        cartaoCor: cartao?.cor ?? '#999',
        totalBrutoCentavos,
        totalAjudasCentavos,
        totalLiquidoCentavos
      }
    })

    const gastosForaCartao = despesaRepo.listarGastosForaCartao({ mesReferencia })
    const recebimentos = recebimentoRepo.listar({ mesReferencia })

    // Ajudas pendentes agrupadas por contribuidor (apenas das faturas deste mês)
    const ajudasPendentes = this.agregarAjudasPendentesDoMes(mesReferencia)

    const totalFaturasLiquidoCentavos = faturas.reduce((s, f) => s + f.totalLiquidoCentavos, 0)
    const totalGastosForaCartaoCentavos = gastosForaCartao.reduce((s, g) => s + g.valorCentavos, 0)
    const totalRecebidoCentavos = recebimentos
      .filter((r) => r.status === 'Recebido')
      .reduce((s, r) => s + r.valorCentavos, 0)
    const totalEsperadoCentavos = recebimentos
      .filter((r) => r.status === 'Esperado')
      .reduce((s, r) => s + r.valorCentavos, 0)

    const totais = calcularBalancoMensal({
      totalFaturasLiquidoCentavos,
      totalGastosForaCartaoCentavos,
      totalRecebidoCentavos,
      totalEsperadoCentavos
    })

    return {
      mesReferencia,
      faturas,
      gastosForaCartao,
      recebimentos,
      ajudasPendentes,
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

  private agregarAjudasPendentesDoMes(mesReferencia: string): AjudaPendentePorContribuidor[] {
    type AgRow = {
      contribuidor_id: number
      total: number
    }
    const rows = this.db
      .prepare(
        `SELECT a.contribuidor_id, SUM(a.valor_centavos) AS total
         FROM ajuda a
         INNER JOIN parcela p ON p.id = a.parcela_id
         INNER JOIN fatura f ON f.id = p.fatura_id
         WHERE f.mes_referencia = ? AND a.status = 'Pendente'
         GROUP BY a.contribuidor_id`
      )
      .all(mesReferencia) as AgRow[]

    if (rows.length === 0) return []

    const ids = rows.map((r) => r.contribuidor_id)
    const placeholders = ids.map(() => '?').join(',')
    const contribRows = this.db
      .prepare(`SELECT * FROM contribuidor WHERE id IN (${placeholders})`)
      .all(...ids) as ContribuidorRow[]
    const porId = new Map<number, Contribuidor>()
    for (const c of contribRows) porId.set(c.id, mapContribuidor(c))

    return rows
      .map((r) => ({
        contribuidorId: r.contribuidor_id,
        contribuidorNome: porId.get(r.contribuidor_id)?.nome ?? `#${r.contribuidor_id}`,
        totalPendenteCentavos: r.total
      }))
      .sort((a, b) => a.contribuidorNome.localeCompare(b.contribuidorNome))
  }
}
