import { contextBridge, ipcRenderer } from 'electron'
// Canais importados do módulo zero-zod para que o bundle do preload não arraste
// zod — pré-requisito para `sandbox: true`. Os demais imports são `import type`
// (apagados em compile, sem custo de runtime).
import {
  CARTAO_IPC_CHANNELS,
  CATEGORIA_IPC_CHANNELS,
  DESPESA_IPC_CHANNELS,
  FATURA_IPC_CHANNELS,
  RENDA_IPC_CHANNELS,
  RECEBIMENTO_IPC_CHANNELS,
  VISAO_MENSAL_IPC_CHANNELS,
  RELATORIO_IPC_CHANNELS,
  ORCAMENTO_IPC_CHANNELS,
  CONFIG_IPC_CHANNELS
} from '@shared/ipc/channels'
import type { CartaoInput, ListCartaoOptions } from '@shared/ipc/cartao'
import type { CategoriaInput, ListCategoriaOptions } from '@shared/ipc/categoria'
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
  ListarDespesasInput,
  ExcluirDespesaInput,
  AtualizarDespesaInput
} from '@shared/ipc/despesa'
import type {
  CriarRendaAvulsaInput,
  CriarRendaRecorrenteInput,
  UpdateRendaInput,
  ListRendaOptions
} from '@shared/ipc/renda'
import type {
  CriarRecebimentoAvulsoInput,
  MarcarRecebidoInput,
  ExcluirRecebimentoInput,
  ListarRecebimentosInput
} from '@shared/ipc/recebimento'
import type { DetalharMesInput } from '@shared/ipc/visao-mensal'
import type {
  TotaisPorCategoriaInput,
  EvolucaoSaldoInput,
  EvolucaoCategoriaInput
} from '@shared/ipc/relatorio'
import type { DefinirLimiteInput, ListarProgressoInput } from '@shared/ipc/orcamento'
import type { Config } from '@shared/ipc/config'

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
    listarDespesas: (input?: ListarDespesasInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.listarDespesas, input ?? {}),
    excluir: (input: ExcluirDespesaInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.excluir, input),
    atualizar: (input: AtualizarDespesaInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.atualizar, input)
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
  },
  relatorio: {
    totaisPorCategoria: (input: TotaisPorCategoriaInput) =>
      ipcRenderer.invoke(RELATORIO_IPC_CHANNELS.totaisPorCategoria, input),
    evolucaoSaldo: (input: EvolucaoSaldoInput) =>
      ipcRenderer.invoke(RELATORIO_IPC_CHANNELS.evolucaoSaldo, input),
    evolucaoCategoria: (input: EvolucaoCategoriaInput) =>
      ipcRenderer.invoke(RELATORIO_IPC_CHANNELS.evolucaoCategoria, input)
  },
  orcamento: {
    definirLimite: (input: DefinirLimiteInput) =>
      ipcRenderer.invoke(ORCAMENTO_IPC_CHANNELS.definirLimite, input),
    removerLimite: (categoriaId: number) =>
      ipcRenderer.invoke(ORCAMENTO_IPC_CHANNELS.removerLimite, categoriaId),
    listarProgresso: (input: ListarProgressoInput) =>
      ipcRenderer.invoke(ORCAMENTO_IPC_CHANNELS.listarProgresso, input)
  },
  config: {
    get: () => ipcRenderer.invoke(CONFIG_IPC_CHANNELS.get),
    set: (config: Config) => ipcRenderer.invoke(CONFIG_IPC_CHANNELS.set, config),
    escolherPastaBackup: () => ipcRenderer.invoke(CONFIG_IPC_CHANNELS.escolherPastaBackup)
  }
})
