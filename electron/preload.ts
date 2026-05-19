import { contextBridge, ipcRenderer } from 'electron'
import { CARTAO_IPC_CHANNELS } from '@shared/ipc/cartao'
import type { CartaoInput, ListCartaoOptions } from '@shared/ipc/cartao'
import { CATEGORIA_IPC_CHANNELS } from '@shared/ipc/categoria'
import type { CategoriaInput, ListCategoriaOptions } from '@shared/ipc/categoria'
import { DESPESA_IPC_CHANNELS } from '@shared/ipc/despesa'
import type {
  DespesaUnicaCreditoInput,
  DespesaParceladaCreditoInput,
  DespesaEmAndamentoInput,
  DespesaAssinaturaCreditoInput,
  CancelarAssinaturaInput,
  ReajustarAssinaturaInput,
  ListarAssinaturasInput,
  AdiantarParcelasInput,
  CancelarPendentesInput,
  DespesaUnicaForaCartaoInput,
  ListarGastosForaCartaoInput
} from '@shared/ipc/despesa'
import { FATURA_IPC_CHANNELS } from '@shared/ipc/fatura'
import { CONTRIBUIDOR_IPC_CHANNELS } from '@shared/ipc/contribuidor'
import type { ContribuidorInput, ListContribuidorOptions } from '@shared/ipc/contribuidor'
import { AJUDA_IPC_CHANNELS } from '@shared/ipc/ajuda'
import type {
  CriarAjudaInput,
  MarcarAjudaRecebidaInput,
  ExcluirAjudaInput,
  ListarAjudasPorParcelaInput,
  ListarAjudasAgrupadasInput
} from '@shared/ipc/ajuda'

contextBridge.exposeInMainWorld('api', {
  cartao: {
    list: (options?: ListCartaoOptions) => ipcRenderer.invoke(CARTAO_IPC_CHANNELS.list, options),
    findById: (id: number) => ipcRenderer.invoke(CARTAO_IPC_CHANNELS.findById, id),
    create: (input: CartaoInput) => ipcRenderer.invoke(CARTAO_IPC_CHANNELS.create, input),
    update: (id: number, input: CartaoInput) =>
      ipcRenderer.invoke(CARTAO_IPC_CHANNELS.update, id, input),
    arquivar: (id: number) => ipcRenderer.invoke(CARTAO_IPC_CHANNELS.arquivar, id),
    desarquivar: (id: number) => ipcRenderer.invoke(CARTAO_IPC_CHANNELS.desarquivar, id)
  },
  categoria: {
    list: (options?: ListCategoriaOptions) =>
      ipcRenderer.invoke(CATEGORIA_IPC_CHANNELS.list, options),
    findById: (id: number) => ipcRenderer.invoke(CATEGORIA_IPC_CHANNELS.findById, id),
    create: (input: CategoriaInput) => ipcRenderer.invoke(CATEGORIA_IPC_CHANNELS.create, input),
    update: (id: number, input: CategoriaInput) =>
      ipcRenderer.invoke(CATEGORIA_IPC_CHANNELS.update, id, input),
    arquivar: (id: number) => ipcRenderer.invoke(CATEGORIA_IPC_CHANNELS.arquivar, id),
    desarquivar: (id: number) => ipcRenderer.invoke(CATEGORIA_IPC_CHANNELS.desarquivar, id)
  },
  despesa: {
    criarUnicaCredito: (input: DespesaUnicaCreditoInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.criarUnicaCredito, input),
    criarParceladaCredito: (input: DespesaParceladaCreditoInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.criarParceladaCredito, input),
    criarParceladaEmAndamento: (input: DespesaEmAndamentoInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.criarParceladaEmAndamento, input),
    adiantarParcelas: (input: AdiantarParcelasInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.adiantarParcelas, input),
    cancelarPendentes: (input: CancelarPendentesInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.cancelarPendentes, input),
    criarAssinaturaCredito: (input: DespesaAssinaturaCreditoInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.criarAssinaturaCredito, input),
    cancelarAssinatura: (input: CancelarAssinaturaInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.cancelarAssinatura, input),
    reajustarValorMensalAssinatura: (input: ReajustarAssinaturaInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.reajustarValorMensalAssinatura, input),
    listarAssinaturas: (input?: ListarAssinaturasInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.listarAssinaturas, input ?? {}),
    criarUnicaForaCartao: (input: DespesaUnicaForaCartaoInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.criarUnicaForaCartao, input),
    listarGastosForaCartao: (input?: ListarGastosForaCartaoInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.listarGastosForaCartao, input ?? {})
  },
  fatura: {
    listarPorCartao: (cartaoId: number) =>
      ipcRenderer.invoke(FATURA_IPC_CHANNELS.listarPorCartao, cartaoId),
    detalharComParcelas: (faturaId: number) =>
      ipcRenderer.invoke(FATURA_IPC_CHANNELS.detalharComParcelas, faturaId),
    fechar: (faturaId: number) => ipcRenderer.invoke(FATURA_IPC_CHANNELS.fechar, faturaId),
    pagar: (faturaId: number, dataPagamento: string) =>
      ipcRenderer.invoke(FATURA_IPC_CHANNELS.pagar, faturaId, dataPagamento),
    reabrir: (faturaId: number) => ipcRenderer.invoke(FATURA_IPC_CHANNELS.reabrir, faturaId)
  },
  contribuidor: {
    list: (options?: ListContribuidorOptions) =>
      ipcRenderer.invoke(CONTRIBUIDOR_IPC_CHANNELS.list, options),
    findById: (id: number) => ipcRenderer.invoke(CONTRIBUIDOR_IPC_CHANNELS.findById, id),
    create: (input: ContribuidorInput) =>
      ipcRenderer.invoke(CONTRIBUIDOR_IPC_CHANNELS.create, input),
    update: (id: number, input: ContribuidorInput) =>
      ipcRenderer.invoke(CONTRIBUIDOR_IPC_CHANNELS.update, id, input),
    arquivar: (id: number) => ipcRenderer.invoke(CONTRIBUIDOR_IPC_CHANNELS.arquivar, id),
    desarquivar: (id: number) => ipcRenderer.invoke(CONTRIBUIDOR_IPC_CHANNELS.desarquivar, id)
  },
  ajuda: {
    criar: (input: CriarAjudaInput) => ipcRenderer.invoke(AJUDA_IPC_CHANNELS.criar, input),
    marcarRecebida: (input: MarcarAjudaRecebidaInput) =>
      ipcRenderer.invoke(AJUDA_IPC_CHANNELS.marcarRecebida, input),
    excluir: (input: ExcluirAjudaInput) => ipcRenderer.invoke(AJUDA_IPC_CHANNELS.excluir, input),
    listarPorParcela: (input: ListarAjudasPorParcelaInput) =>
      ipcRenderer.invoke(AJUDA_IPC_CHANNELS.listarPorParcela, input),
    listarAgrupadoPorContribuidor: (input?: ListarAjudasAgrupadasInput) =>
      ipcRenderer.invoke(AJUDA_IPC_CHANNELS.listarAgrupadoPorContribuidor, input ?? {})
  }
})
