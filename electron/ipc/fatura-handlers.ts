import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import type { Despesa } from '../../src/domain/entities/despesa'
import { DespesaRepository } from '../../src/persistence/repositories/despesa-repository'
import { FaturaRepository } from '../../src/persistence/repositories/fatura-repository'
import { ParcelaRepository } from '../../src/persistence/repositories/parcela-repository'
import { fecharFatura, pagarFatura, reabrirFatura } from '../../src/domain/services/ciclo-fatura'
import {
  descreverOcorrencia,
  type Ocorrencia
} from '../../src/domain/services/descrever-ocorrencia'
import { hojeIsoLocal } from '../../src/shared/datas-locais'
import {
  cartaoIdSchema,
  faturaIdSchema,
  FATURA_IPC_CHANNELS,
  pagarFaturaInputSchema
} from '../../src/shared/ipc/fatura'
import type { FaturaDetalhada } from '../../src/shared/ipc/fatura'

export function registerFaturaHandlers(db: Database, ipcMain: IpcMain): void {
  const despesaRepo = new DespesaRepository(db)
  const faturaRepo = new FaturaRepository(db)
  const parcelaRepo = new ParcelaRepository(db)

  // É o caminho de leitura da tela de Faturas, e por isso aplica o RN-06 antes
  // de listar — como `VisaoMensalRepository.detalhar` faz na Visão mensal. A
  // fatura nasce sempre Aberta, inclusive a de um lançamento retroativo, e sem
  // isto seguia Aberta aqui até o boot ou o timer de uma hora, enquanto a Visão
  // mensal já a mostrava Fechada.
  ipcMain.handle(FATURA_IPC_CHANNELS.listarResumoPorCartao, (_event, payload: unknown) => {
    const cartaoId = cartaoIdSchema.parse(payload)
    faturaRepo.fecharVencidas(hojeIsoLocal())
    return faturaRepo.listarResumoPorCartao(cartaoId)
  })

  ipcMain.handle(FATURA_IPC_CHANNELS.listarPorCartao, (_event, payload: unknown) => {
    const cartaoId = cartaoIdSchema.parse(payload)
    return faturaRepo.list(cartaoId)
  })

  ipcMain.handle(
    FATURA_IPC_CHANNELS.detalharComParcelas,
    (_event, payload: unknown): FaturaDetalhada | null => {
      const faturaId = faturaIdSchema.parse(payload)
      const fatura = faturaRepo.findById(faturaId)
      if (!fatura) return null

      const parcelas = parcelaRepo.listarPorFatura(faturaId)
      const totalCentavos = parcelas.reduce((sum, p) => sum + p.valorCentavos, 0)

      const despesaIds = [...new Set(parcelas.map((p) => p.despesaId))]
      const despesas = despesaRepo.listarPorIds(despesaIds)
      const despPorId = new Map(despesas.map((d) => [d.id, d]))
      const despesasPorParcela: Record<number, Despesa> = {}
      for (const p of parcelas) {
        const d = despPorId.get(p.despesaId)
        if (d) despesasPorParcela[p.id] = d
      }

      const exclusaoBloqueada = Object.fromEntries(despesaRepo.bloqueiosDeExclusao(despesaIds))

      // O mesmo enriquecimento da lista de Saídas, para a parcela ter o mesmo
      // nome nas duas telas.
      const menorNumero = parcelaRepo.menorNumeroPorDespesa(despesaIds)
      const ocorrenciaPorParcela: Record<number, Ocorrencia> = {}
      for (const p of parcelas) {
        const d = despPorId.get(p.despesaId)
        if (d) {
          ocorrenciaPorParcela[p.id] = descreverOcorrencia(d, p, menorNumero.get(d.id) ?? p.numero)
        }
      }

      return {
        fatura,
        parcelas,
        totalCentavos,
        despesasPorParcela,
        exclusaoBloqueada,
        ocorrenciaPorParcela
      }
    }
  )

  ipcMain.handle(FATURA_IPC_CHANNELS.fechar, (_event, payload: unknown) => {
    const faturaId = faturaIdSchema.parse(payload)
    const fatura = faturaRepo.findById(faturaId)
    if (!fatura) throw new Error(`Fatura #${faturaId} não encontrada`)
    const resultado = fecharFatura(fatura)
    if (!resultado.ok) throw new Error(resultado.erro)
    return faturaRepo.fechar(faturaId)
  })

  ipcMain.handle(FATURA_IPC_CHANNELS.pagar, (_event, faturaIdRaw: unknown, dataRaw: unknown) => {
    const { faturaId, dataPagamento } = pagarFaturaInputSchema.parse({
      faturaId: faturaIdRaw,
      dataPagamento: dataRaw
    })
    const fatura = faturaRepo.findById(faturaId)
    if (!fatura) throw new Error(`Fatura #${faturaId} não encontrada`)
    const resultado = pagarFatura(fatura, dataPagamento)
    if (!resultado.ok) throw new Error(resultado.erro)
    return faturaRepo.pagar(faturaId, dataPagamento)
  })

  ipcMain.handle(FATURA_IPC_CHANNELS.reabrir, (_event, payload: unknown) => {
    const faturaId = faturaIdSchema.parse(payload)
    const fatura = faturaRepo.findById(faturaId)
    if (!fatura) throw new Error(`Fatura #${faturaId} não encontrada`)
    const resultado = reabrirFatura(fatura, hojeIsoLocal())
    if (!resultado.ok) throw new Error(resultado.erro)
    if (resultado.novoStatus.kind === 'Paga') {
      throw new Error('reabrir: transição inesperada para Paga')
    }
    return faturaRepo.reabrir(faturaId, resultado.novoStatus.kind)
  })
}
