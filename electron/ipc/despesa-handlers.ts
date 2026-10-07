import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import type { DespesaComTags, OcorrenciaDoMes } from '../../src/shared/ipc/despesa'
import { descreverOcorrencia } from '../../src/domain/services/descrever-ocorrencia'
import { DespesaRepository } from '../../src/persistence/repositories/despesa-repository'
import { ParcelaRepository } from '../../src/persistence/repositories/parcela-repository'
import { TagRepository } from '../../src/persistence/repositories/tag-repository'
import {
  despesaUnicaCreditoInputSchema,
  despesaParceladaCreditoInputSchema,
  despesaEmAndamentoInputSchema,
  despesaAssinaturaCreditoInputSchema,
  cancelarAssinaturaInputSchema,
  despesaAssinaturaForaCartaoInputSchema,
  atualizarLimiteRecorrenciaInputSchema,
  reajustarAssinaturaInputSchema,
  listarAssinaturasInputSchema,
  adiantarParcelasInputSchema,
  cancelarPendentesInputSchema,
  despesaUnicaForaCartaoInputSchema,
  listarGastosForaCartaoInputSchema,
  listarDespesasInputSchema,
  listarOcorrenciasInputSchema,
  excluirDespesaInputSchema,
  atualizarDespesaInputSchema,
  definirNotaETagsInputSchema,
  buscarOcorrenciasInputSchema,
  marcarOcorrenciaPagaInputSchema,
  desmarcarOcorrenciaPagaInputSchema,
  DESPESA_IPC_CHANNELS
} from '../../src/shared/ipc/despesa'

export function registerDespesaHandlers(db: Database, ipcMain: IpcMain): void {
  const repo = new DespesaRepository(db)
  const parcelaRepo = new ParcelaRepository(db)

  ipcMain.handle(DESPESA_IPC_CHANNELS.criarUnicaCredito, (_event, payload: unknown) => {
    const input = despesaUnicaCreditoInputSchema.parse(payload)
    return repo.criarUnicaCredito(input)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.criarParceladaCredito, (_event, payload: unknown) => {
    const input = despesaParceladaCreditoInputSchema.parse(payload)
    return repo.criarParceladaCredito(input)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.criarParceladaEmAndamento, (_event, payload: unknown) => {
    const input = despesaEmAndamentoInputSchema.parse(payload)
    return repo.criarParceladaEmAndamento(input)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.adiantarParcelas, (_event, payload: unknown) => {
    const input = adiantarParcelasInputSchema.parse(payload)
    return parcelaRepo.adiantar(input)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.cancelarPendentes, (_event, payload: unknown) => {
    const { despesaId } = cancelarPendentesInputSchema.parse(payload)
    return parcelaRepo.cancelarPendentes(despesaId)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.criarAssinaturaCredito, (_event, payload: unknown) => {
    const input = despesaAssinaturaCreditoInputSchema.parse(payload)
    return repo.criarAssinaturaCredito(input)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.criarAssinaturaForaCartao, (_event, payload: unknown) => {
    const input = despesaAssinaturaForaCartaoInputSchema.parse(payload)
    return repo.criarAssinaturaForaCartao(input)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.atualizarLimiteRecorrencia, (_event, payload: unknown) => {
    const { despesaId, recorreAte } = atualizarLimiteRecorrenciaInputSchema.parse(payload)
    return repo.atualizarLimiteRecorrencia(despesaId, recorreAte)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.cancelarAssinatura, (_event, payload: unknown) => {
    const { despesaId } = cancelarAssinaturaInputSchema.parse(payload)
    return repo.cancelarAssinatura(despesaId)
  })

  ipcMain.handle(
    DESPESA_IPC_CHANNELS.reajustarValorMensalAssinatura,
    (_event, payload: unknown) => {
      const { despesaId, novoValorCentavos } = reajustarAssinaturaInputSchema.parse(payload)
      return repo.reajustarValorMensalAssinatura(despesaId, novoValorCentavos)
    }
  )

  ipcMain.handle(DESPESA_IPC_CHANNELS.listarAssinaturas, (_event, payload: unknown) => {
    const filtro = listarAssinaturasInputSchema.parse(payload ?? {})
    return repo.listarAssinaturas(filtro)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.criarUnicaForaCartao, (_event, payload: unknown) => {
    const input = despesaUnicaForaCartaoInputSchema.parse(payload)
    return repo.criarUnicaForaCartao(input)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.listarGastosForaCartao, (_event, payload: unknown) => {
    const filtro = listarGastosForaCartaoInputSchema.parse(payload ?? {})
    return repo.listarGastosForaCartao(filtro)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.listarDespesas, (_event, payload: unknown) => {
    const filtro = listarDespesasInputSchema.parse(payload ?? {})
    return repo.listarDespesas(filtro)
  })

  ipcMain.handle(
    DESPESA_IPC_CHANNELS.listarComTags,
    (_event, payload: unknown): DespesaComTags[] => {
      const filtro = listarDespesasInputSchema.parse(payload ?? {})
      const despesas = repo.listarDespesas(filtro)
      const tagsMap = new TagRepository(db).tagsPorDespesaIds(despesas.map((d) => d.id))
      return despesas.map((d) => ({ ...d, tags: tagsMap.get(d.id) ?? [] }))
    }
  )

  /**
   * Enriquece as linhas cruas do JOIN com o que o domain calcula
   * (`descreverOcorrencia`) e com as tags.
   *
   * Compartilhado pela lista mensal (RF-DES-14) e pela busca por período
   * (RF-DES-22): as duas devolvem `OcorrenciaDoMes`, e duas cópias fariam o
   * rótulo da parcela ou o impacto divergirem entre as telas para a MESMA
   * linha — que é o defeito que este projeto ja pagou em modais e tabelas.
   */
  function enriquecer(linhas: ReturnType<typeof repo.listarOcorrenciasDoMes>): OcorrenciaDoMes[] {
    const tagsMap = new TagRepository(db).tagsPorDespesaIds(linhas.map((l) => l.despesa_id))

    return linhas.map((l) => {
      const { impactoCentavos, origemCentavos, rotuloParcela, progressoPct } = descreverOcorrencia(
        {
          tipo: l.tipo,
          valorCentavos: l.despesa_valor_centavos,
          totalParcelas: l.total_parcelas
        },
        {
          numero: l.numero,
          total: l.total,
          valorCentavos: l.parcela_valor_centavos,
          dataReferencia: l.data_referencia,
          status: l.status
        },
        l.menor_numero
      )

      return {
        parcelaId: l.parcela_id,
        despesaId: l.despesa_id,
        descricao: l.descricao,
        categoriaId: l.categoria_id,
        cartaoId: l.cartao_id,
        formaPagamento: l.forma_pagamento,
        tipo: l.tipo,
        dataCompra: l.data_compra,
        dataReferencia: l.data_referencia,
        faturaId: l.fatura_id,
        statusParcela: l.status,
        ativa: l.ativa === 1,
        nota: l.nota ?? null,
        tags: tagsMap.get(l.despesa_id) ?? [],
        impactoCentavos,
        origemCentavos,
        rotuloParcela,
        progressoPct,
        // Fora de fatura o campo fica ausente, e não null: é opcional no contrato.
        ...(l.fatura_status === null ? {} : { statusFatura: l.fatura_status })
      }
    })
  }

  ipcMain.handle(
    DESPESA_IPC_CHANNELS.listarOcorrenciasDoMes,
    (_event, payload: unknown): OcorrenciaDoMes[] => {
      const { mesReferencia } = listarOcorrenciasInputSchema.parse(payload)
      const ocorrencias = enriquecer(repo.listarOcorrenciasDoMes(mesReferencia))
      // RF-DES-09: o bloqueio é da despesa, e a regra olha todas as parcelas
      // dela. Saídas oferecia Excluir em toda linha e só descobria o bloqueio
      // depois do diálogo "irreversível", como Faturas antes da v1.19.0.
      const bloqueios = repo.bloqueiosDeExclusao(ocorrencias.map((o) => o.despesaId))
      return ocorrencias.map((o) => {
        const motivo = bloqueios.get(o.despesaId)
        return motivo ? { ...o, motivoBloqueioExclusao: motivo } : o
      })
    }
  )

  // RF-DES-22 — a mesma forma de resultado, num intervalo de meses.
  ipcMain.handle(
    DESPESA_IPC_CHANNELS.buscarOcorrencias,
    (_event, payload: unknown): OcorrenciaDoMes[] => {
      const { mesInicio, mesFim } = buscarOcorrenciasInputSchema.parse(payload)
      return enriquecer(repo.listarOcorrenciasNoPeriodo(mesInicio, mesFim))
    }
  )

  ipcMain.handle(DESPESA_IPC_CHANNELS.listarTags, () =>
    new TagRepository(db).listar().map((t) => t.nome)
  )

  ipcMain.handle(DESPESA_IPC_CHANNELS.definirNotaETags, (_event, payload: unknown) => {
    const { despesaId, nota, tags } = definirNotaETagsInputSchema.parse(payload)
    return repo.definirNotaETags(despesaId, { nota, tags })
  })

  // RF-DES-21. Vive no grupo de despesa, e nao num grupo `parcela:*` novo,
  // porque a tela que dispara e Saidas — que lista ocorrencias de despesa — e
  // porque um grupo novo exigiria registro em `main.ts` e em
  // `reregistrarHandlersDeDados`, duas listas que ja divergiram no passado.
  ipcMain.handle(DESPESA_IPC_CHANNELS.marcarOcorrenciaPaga, (_event, payload: unknown) => {
    const { parcelaId, dataPagamento } = marcarOcorrenciaPagaInputSchema.parse(payload)
    return parcelaRepo.marcarPaga(parcelaId, dataPagamento)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.desmarcarOcorrenciaPaga, (_event, payload: unknown) => {
    const { parcelaId } = desmarcarOcorrenciaPagaInputSchema.parse(payload)
    return parcelaRepo.desmarcarPaga(parcelaId)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.excluir, (_event, payload: unknown) => {
    const { despesaId } = excluirDespesaInputSchema.parse(payload)
    return repo.excluir(despesaId)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.atualizar, (_event, payload: unknown) => {
    const { despesaId, ...input } = atualizarDespesaInputSchema.parse(payload)
    return repo.atualizar(despesaId, input)
  })
}
