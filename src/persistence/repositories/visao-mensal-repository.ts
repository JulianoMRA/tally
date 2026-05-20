import type { Database } from '../database'
import type { Cartao } from '../../domain/entities/cartao'
import type { Fatura, StatusFatura } from '../../domain/entities/fatura'
import type { FaturaResumida, VisaoMensalDetalhada } from '../../shared/ipc/visao-mensal'
import type { Repository } from './types'
import { calcularBalancoMensal } from '../../domain/services/calcular-balanco-mensal'
import { diferencaEmMeses } from '../../domain/services/mes-referencia'
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

export class VisaoMensalRepository implements Repository {
  constructor(public readonly db: Database) {}

  detalhar(mesReferencia: string): VisaoMensalDetalhada {
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
