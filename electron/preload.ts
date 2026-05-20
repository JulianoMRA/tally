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
  ListarGastosForaCartaoInput,
  ExcluirDespesaInput
} from '@shared/ipc/despesa'
import { FATURA_IPC_CHANNELS } from '@shared/ipc/fatura'
import { RENDA_IPC_CHANNELS } from '@shared/ipc/renda'
import type {
  CriarRendaAvulsaInput,
  CriarRendaRecorrenteInput,
  UpdateRendaInput,
  ListRendaOptions
} from '@shared/ipc/renda'
import { RECEBIMENTO_IPC_CHANNELS } from '@shared/ipc/recebimento'
import type {
  CriarRecebimentoAvulsoInput,
  MarcarRecebidoInput,
  ExcluirRecebimentoInput,
  ListarRecebimentosInput
} from '@shared/ipc/recebimento'
import { VISAO_MENSAL_IPC_CHANNELS } from '@shared/ipc/visao-mensal'
import type { DetalharMesInput } from '@shared/ipc/visao-mensal'

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
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.listarGastosForaCartao, input ?? {}),
    excluir: (input: ExcluirDespesaInput) => ipcRenderer.invoke(DESPESA_IPC_CHANNELS.excluir, input)
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
  renda: {
    list: (options?: ListRendaOptions) => ipcRenderer.invoke(RENDA_IPC_CHANNELS.list, options),
    findById: (id: number) => ipcRenderer.invoke(RENDA_IPC_CHANNELS.findById, id),
    criarAvulsa: (input: CriarRendaAvulsaInput) =>
      ipcRenderer.invoke(RENDA_IPC_CHANNELS.criarAvulsa, input),
    criarRecorrente: (input: CriarRendaRecorrenteInput) =>
      ipcRenderer.invoke(RENDA_IPC_CHANNELS.criarRecorrente, input),
    update: (id: number, input: UpdateRendaInput) =>
      ipcRenderer.invoke(RENDA_IPC_CHANNELS.update, id, input),
    arquivar: (id: number) => ipcRenderer.invoke(RENDA_IPC_CHANNELS.arquivar, id),
    desarquivar: (id: number) => ipcRenderer.invoke(RENDA_IPC_CHANNELS.desarquivar, id)
  },
  recebimento: {
    criarAvulso: (input: CriarRecebimentoAvulsoInput) =>
      ipcRenderer.invoke(RECEBIMENTO_IPC_CHANNELS.criarAvulso, input),
    listar: (input?: ListarRecebimentosInput) =>
      ipcRenderer.invoke(RECEBIMENTO_IPC_CHANNELS.listar, input ?? {}),
    marcarRecebido: (input: MarcarRecebidoInput) =>
      ipcRenderer.invoke(RECEBIMENTO_IPC_CHANNELS.marcarRecebido, input),
    excluir: (input: ExcluirRecebimentoInput) =>
      ipcRenderer.invoke(RECEBIMENTO_IPC_CHANNELS.excluir, input)
  },
  visaoMensal: {
    detalhar: (input: DetalharMesInput) =>
      ipcRenderer.invoke(VISAO_MENSAL_IPC_CHANNELS.detalhar, input)
  }
})
