import type { Database } from '../database'
import type { Ajuda, StatusAjuda } from '../../domain/entities/ajuda'
import type { Contribuidor } from '../../domain/entities/contribuidor'
import type { Parcela, StatusParcela } from '../../domain/entities/parcela'
import type { Fatura, StatusFatura } from '../../domain/entities/fatura'
import type { Repository } from './types'
import { selecionarParcelasParaReplicarAjuda } from '../../domain/services/replicar-ajuda-recorrente'

type AjudaRow = {
  id: number
  contribuidor_id: number
  parcela_id: number
  valor_centavos: number
  status: StatusAjuda
  data_recebimento: string | null
  recorrente: 0 | 1
  created_at: string
  updated_at: string
}

function mapRow(row: AjudaRow): Ajuda {
  return {
    id: row.id,
    contribuidorId: row.contribuidor_id,
    parcelaId: row.parcela_id,
    valorCentavos: row.valor_centavos,
    status: row.status,
    dataRecebimento: row.data_recebimento,
    recorrente: row.recorrente === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

type ParcelaRow = {
  id: number
  despesa_id: number
  fatura_id: number | null
  numero: number
  total: number | null
  valor_centavos: number
  data_referencia: string
  status: StatusParcela
  data_pagamento: string | null
  created_at: string
  updated_at: string
}

function mapParcelaRow(row: ParcelaRow): Parcela {
  return {
    id: row.id,
    despesaId: row.despesa_id,
    faturaId: row.fatura_id,
    numero: row.numero,
    total: row.total,
    valorCentavos: row.valor_centavos,
    dataReferencia: row.data_referencia,
    status: row.status,
    dataPagamento: row.data_pagamento,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
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

function mapFaturaRow(row: FaturaRow): Fatura {
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

export type CriarAjudaInput = {
  contribuidorId: number
  parcelaId: number
  valorCentavos: number
  recorrente: boolean
}

export type ResultadoCriarAjuda = {
  criadas: Ajuda[]
}

export type AjudaComContexto = Ajuda & {
  descricaoDespesa: string
  mesReferencia: string | null
  dataReferenciaParcela: string
}

export type AjudaAgrupada = {
  contribuidor: Contribuidor
  totalCentavos: number
  totalPendentesCentavos: number
  ajudas: AjudaComContexto[]
}

export class AjudaRepository implements Repository {
  constructor(public readonly db: Database) {}

  findById(id: number): Ajuda | null {
    const row = this.db.prepare('SELECT * FROM ajuda WHERE id = ?').get(id) as AjudaRow | undefined
    return row ? mapRow(row) : null
  }

  listarPorParcela(parcelaId: number): Ajuda[] {
    const rows = this.db
      .prepare('SELECT * FROM ajuda WHERE parcela_id = ? ORDER BY id ASC')
      .all(parcelaId) as AjudaRow[]
    return rows.map(mapRow)
  }

  listarPorFatura(faturaId: number): Ajuda[] {
    const rows = this.db
      .prepare(
        `SELECT a.* FROM ajuda a
         INNER JOIN parcela p ON p.id = a.parcela_id
         WHERE p.fatura_id = ?
         ORDER BY a.id ASC`
      )
      .all(faturaId) as AjudaRow[]
    return rows.map(mapRow)
  }

  totaisPorFatura(faturaId: number): { totalAjudasCentavos: number; ajudas: Ajuda[] } {
    const ajudas = this.listarPorFatura(faturaId)
    const totalAjudasCentavos = ajudas.reduce((s, a) => s + a.valorCentavos, 0)
    return { totalAjudasCentavos, ajudas }
  }

  criar(input: CriarAjudaInput): ResultadoCriarAjuda {
    if (!Number.isInteger(input.valorCentavos) || input.valorCentavos <= 0) {
      throw new Error(`valorCentavos deve ser inteiro > 0, recebido: ${input.valorCentavos}`)
    }

    const parcelaRow = this.db
      .prepare('SELECT * FROM parcela WHERE id = ?')
      .get(input.parcelaId) as ParcelaRow | undefined
    if (!parcelaRow) throw new Error(`Parcela #${input.parcelaId} não encontrada`)
    const parcelaOrigem = mapParcelaRow(parcelaRow)

    return this.db.transaction(() => {
      const ajudasCriadas: Ajuda[] = []
      ajudasCriadas.push(
        this.inserirAjuda({
          contribuidorId: input.contribuidorId,
          parcelaId: parcelaOrigem.id,
          valorCentavos: input.valorCentavos,
          recorrente: input.recorrente
        })
      )

      if (!input.recorrente) return { criadas: ajudasCriadas }

      const despesaRow = this.db
        .prepare('SELECT id, tipo FROM despesa WHERE id = ?')
        .get(parcelaOrigem.despesaId) as { id: number; tipo: string } | undefined
      if (!despesaRow) return { criadas: ajudasCriadas }
      if (despesaRow.tipo !== 'Parcelada' && despesaRow.tipo !== 'Assinatura') {
        return { criadas: ajudasCriadas }
      }

      const parcelas = this.listarParcelasDaDespesa(parcelaOrigem.despesaId)
      const faturaIds = [
        ...new Set(parcelas.map((p) => p.faturaId).filter((id): id is number => id !== null))
      ]
      const faturasIndex = new Map<number, Fatura>()
      for (const fid of faturaIds) {
        const row = this.db.prepare('SELECT * FROM fatura WHERE id = ?').get(fid) as
          | FaturaRow
          | undefined
        if (row) faturasIndex.set(fid, mapFaturaRow(row))
      }

      const alvos = selecionarParcelasParaReplicarAjuda(parcelas, faturasIndex, parcelaOrigem)
      for (const alvo of alvos) {
        ajudasCriadas.push(
          this.inserirAjuda({
            contribuidorId: input.contribuidorId,
            parcelaId: alvo.id,
            valorCentavos: input.valorCentavos,
            recorrente: true
          })
        )
      }

      return { criadas: ajudasCriadas }
    })()
  }

  private inserirAjuda(input: CriarAjudaInput): Ajuda {
    const info = this.db
      .prepare(
        `INSERT INTO ajuda (contribuidor_id, parcela_id, valor_centavos, recorrente)
         VALUES (?, ?, ?, ?)`
      )
      .run(input.contribuidorId, input.parcelaId, input.valorCentavos, input.recorrente ? 1 : 0)
    const row = this.db
      .prepare('SELECT * FROM ajuda WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as AjudaRow | undefined
    if (!row) throw new Error('Falha ao recuperar ajuda após inserir')
    return mapRow(row)
  }

  private listarParcelasDaDespesa(despesaId: number): Parcela[] {
    const rows = this.db
      .prepare('SELECT * FROM parcela WHERE despesa_id = ? ORDER BY numero ASC')
      .all(despesaId) as ParcelaRow[]
    return rows.map(mapParcelaRow)
  }

  marcarRecebida(ajudaId: number, dataRecebimento: string): Ajuda {
    const info = this.db
      .prepare(
        `UPDATE ajuda
         SET status = 'Recebida', data_recebimento = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(dataRecebimento, ajudaId)
    if (info.changes === 0) throw new Error(`Ajuda #${ajudaId} não encontrada`)
    const ajuda = this.findById(ajudaId)
    if (!ajuda) throw new Error(`Falha ao recuperar ajuda #${ajudaId} após marcar recebida`)
    return ajuda
  }

  excluir(ajudaId: number): void {
    const info = this.db.prepare('DELETE FROM ajuda WHERE id = ?').run(ajudaId)
    if (info.changes === 0) throw new Error(`Ajuda #${ajudaId} não encontrada`)
  }

  listarAgrupadoPorContribuidor(filtro?: { status?: StatusAjuda }): AjudaAgrupada[] {
    type Row = AjudaRow & {
      descricao_despesa: string
      mes_referencia: string | null
      data_referencia_parcela: string
      contribuidor_nome: string
      contribuidor_contato: string | null
      contribuidor_ativo: 0 | 1
      contribuidor_created_at: string
      contribuidor_updated_at: string
    }

    let sql = `
      SELECT
        a.*,
        d.descricao AS descricao_despesa,
        f.mes_referencia AS mes_referencia,
        p.data_referencia AS data_referencia_parcela,
        c.nome AS contribuidor_nome,
        c.contato AS contribuidor_contato,
        c.ativo AS contribuidor_ativo,
        c.created_at AS contribuidor_created_at,
        c.updated_at AS contribuidor_updated_at
      FROM ajuda a
      INNER JOIN parcela p ON p.id = a.parcela_id
      INNER JOIN despesa d ON d.id = p.despesa_id
      LEFT JOIN fatura f ON f.id = p.fatura_id
      INNER JOIN contribuidor c ON c.id = a.contribuidor_id
    `
    const params: unknown[] = []
    if (filtro?.status) {
      sql += ' WHERE a.status = ?'
      params.push(filtro.status)
    }
    sql += ' ORDER BY c.nome ASC, p.data_referencia ASC, a.id ASC'

    const rows = this.db.prepare(sql).all(...params) as Row[]

    const porContribuidor = new Map<number, AjudaAgrupada>()
    for (const r of rows) {
      const ajuda = mapRow(r)
      const ctx: AjudaComContexto = {
        ...ajuda,
        descricaoDespesa: r.descricao_despesa,
        mesReferencia: r.mes_referencia,
        dataReferenciaParcela: r.data_referencia_parcela
      }
      let grupo = porContribuidor.get(ajuda.contribuidorId)
      if (!grupo) {
        grupo = {
          contribuidor: {
            id: ajuda.contribuidorId,
            nome: r.contribuidor_nome,
            contato: r.contribuidor_contato,
            ativo: r.contribuidor_ativo === 1,
            createdAt: r.contribuidor_created_at,
            updatedAt: r.contribuidor_updated_at
          },
          totalCentavos: 0,
          totalPendentesCentavos: 0,
          ajudas: []
        }
        porContribuidor.set(ajuda.contribuidorId, grupo)
      }
      grupo.totalCentavos += ajuda.valorCentavos
      if (ajuda.status === 'Pendente') grupo.totalPendentesCentavos += ajuda.valorCentavos
      grupo.ajudas.push(ctx)
    }

    return [...porContribuidor.values()].sort((a, b) =>
      a.contribuidor.nome.localeCompare(b.contribuidor.nome)
    )
  }
}
