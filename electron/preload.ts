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
  CONFIG_IPC_CHANNELS,
  DADOS_IPC_CHANNELS,
  APP_IPC_CHANNELS,
  JANELA_IPC_CHANNELS,
  TEMA_IPC_CHANNELS
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
  ListarOcorrenciasInput,
  ExcluirDespesaInput,
  AtualizarDespesaInput,
  DefinirNotaETagsInput
} from '@shared/ipc/despesa'
import type {
  CriarRendaRecorrenteInput,
  UpdateRendaInput,
  ListRendaOptions
} from '@shared/ipc/renda'
import type {
  CriarRecebimentoAvulsoInput,
  AtualizarRecebimentoInput,
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
import type {
  DefinirLimiteInput,
  RemoverLimiteInput,
  ListarProgressoInput
} from '@shared/ipc/orcamento'
import type { Config, RestaurarBackupInput, Tema } from '@shared/ipc/config'
import type { ImportarCsvInput, ExportarMesInput } from '@shared/ipc/importacao'

/**
 * Carimba o tema no <html> ANTES de a folha de estilo do <head> ser avaliada.
 *
 * Duas armadilhas, as duas descobertas rodando o app de verdade:
 *
 * 1. `document.documentElement` E NULL AQUI. Com `sandbox: true`, o preload
 *    roda antes de o parser criar o <html>. Chamar `setAttribute` direto
 *    lancava, e como a excecao derrubava o modulo inteiro, o
 *    `exposeInMainWorld` la embaixo nunca rodava: `window.api` ficava
 *    undefined e o app inteiro quebrava na primeira tela. Um MutationObserver
 *    no proprio `document` entrega o atributo no mesmo tick em que o <html>
 *    nasce — antes, portanto, de qualquer <link> do <head> ser processado.
 *
 * 2. Nada aqui pode derrubar a ponte. Tema e cosmetico; `window.api` e o app.
 *    Dai o try/catch em volta de tudo, e nao so da leitura do settings.
 *
 * A leitura e sincrona porque `invoke` devolveria promessa, e a promessa
 * resolveria depois do primeiro paint — o app abriria creme e viraria escuro.
 * E a unica chamada sincrona da ponte.
 */
function lerTemaGravado(): Tema {
  // A rota de impressao roda numa BrowserWindow oculta que carrega ESTE mesmo
  // bundle, e o resultado dela e um PDF em papel A4. Papel nao tem tema: se o
  // documento herdasse o escuro, a folha sairia branca com tinta quase branca,
  // e o guard de cores nao avisaria — ele permite explicitamente o hex do
  // print-mensal. Primeira das duas camadas; a outra e o `data-theme="claro"`
  // no proprio elemento da folha, que sobrevive a alguem mexer aqui.
  if (location.hash.startsWith('#/print/')) return 'claro'

  try {
    return (ipcRenderer.sendSync(TEMA_IPC_CHANNELS.inicialSync) as Tema) ?? 'claro'
  } catch {
    // Config ilegivel nunca impede o boot — mesma postura do `lerConfig`.
    return 'claro'
  }
}

function carimbarTemaInicial(): Tema {
  const tema = lerTemaGravado()

  try {
    if (document.documentElement) {
      document.documentElement.setAttribute('data-theme', tema)
    } else {
      const observador = new MutationObserver(() => {
        if (!document.documentElement) return
        document.documentElement.setAttribute('data-theme', tema)
        observador.disconnect()
      })
      observador.observe(document, { childList: true })
    }
  } catch {
    // Sem tema o app abre no claro, que e o padrao e resolve pelo :root. Uma
    // falha aqui nunca pode impedir a ponte de ser exposta.
  }

  return tema
}

const temaInicial = carimbarTemaInicial()

contextBridge.exposeInMainWorld('api', {
  tema: {
    inicial: () => temaInicial,
    definir: (tema: Tema) => ipcRenderer.invoke(TEMA_IPC_CHANNELS.definir, tema)
  },
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
    listarComTags: (input?: ListarDespesasInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.listarComTags, input ?? {}),
    listarOcorrenciasDoMes: (input: ListarOcorrenciasInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.listarOcorrenciasDoMes, input),
    listarTags: () => ipcRenderer.invoke(DESPESA_IPC_CHANNELS.listarTags),
    excluir: (input: ExcluirDespesaInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.excluir, input),
    atualizar: (input: AtualizarDespesaInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.atualizar, input),
    definirNotaETags: (input: DefinirNotaETagsInput) =>
      ipcRenderer.invoke(DESPESA_IPC_CHANNELS.definirNotaETags, input)
  },
  fatura: {
    listarPorCartao: (cartaoId: number) =>
      ipcRenderer.invoke(FATURA_IPC_CHANNELS.listarPorCartao, cartaoId),
    listarResumoPorCartao: (cartaoId: number) =>
      ipcRenderer.invoke(FATURA_IPC_CHANNELS.listarResumoPorCartao, cartaoId),
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
    atualizar: (input: AtualizarRecebimentoInput) =>
      ipcRenderer.invoke(RECEBIMENTO_IPC_CHANNELS.atualizar, input),
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
    removerLimite: (input: RemoverLimiteInput) =>
      ipcRenderer.invoke(ORCAMENTO_IPC_CHANNELS.removerLimite, input),
    listarProgresso: (input: ListarProgressoInput) =>
      ipcRenderer.invoke(ORCAMENTO_IPC_CHANNELS.listarProgresso, input)
  },
  config: {
    get: () => ipcRenderer.invoke(CONFIG_IPC_CHANNELS.get),
    set: (config: Config) => ipcRenderer.invoke(CONFIG_IPC_CHANNELS.set, config),
    escolherPastaBackup: () => ipcRenderer.invoke(CONFIG_IPC_CHANNELS.escolherPastaBackup),
    listarBackups: () => ipcRenderer.invoke(CONFIG_IPC_CHANNELS.listarBackups),
    criarBackupAgora: () => ipcRenderer.invoke(CONFIG_IPC_CHANNELS.criarBackupAgora),
    restaurarBackup: (input: RestaurarBackupInput) =>
      ipcRenderer.invoke(CONFIG_IPC_CHANNELS.restaurarBackup, input),
    abrirPastaBackups: () => ipcRenderer.invoke(CONFIG_IPC_CHANNELS.abrirPastaBackups)
  },
  janela: {
    minimizar: () => ipcRenderer.invoke(JANELA_IPC_CHANNELS.minimizar),
    alternarMaximizada: () => ipcRenderer.invoke(JANELA_IPC_CHANNELS.alternarMaximizada),
    fechar: () => ipcRenderer.invoke(JANELA_IPC_CHANNELS.fechar),
    estaMaximizada: () => ipcRenderer.invoke(JANELA_IPC_CHANNELS.estaMaximizada),
    // Devolve o cancelamento em vez de expor o `ipcRenderer`: o renderer nunca
    // recebe o objeto, só a assinatura e o jeito de desfazê-la.
    aoMudarEstado: (ouvinte: (maximizada: boolean) => void) => {
      const handler = (_evento: unknown, maximizada: boolean) => ouvinte(maximizada)
      ipcRenderer.on(JANELA_IPC_CHANNELS.mudouEstado, handler)
      return () => {
        ipcRenderer.removeListener(JANELA_IPC_CHANNELS.mudouEstado, handler)
      }
    },
    controlesProprios: process.platform === 'win32'
  },
  app: {
    exportarDados: () => ipcRenderer.invoke(APP_IPC_CHANNELS.exportarDados),
    importarDados: () => ipcRenderer.invoke(APP_IPC_CHANNELS.importarDados),
    verificarAtualizacoes: () => ipcRenderer.invoke(APP_IPC_CHANNELS.verificarAtualizacoes),
    sair: () => ipcRenderer.invoke(APP_IPC_CHANNELS.sair)
  },
  dados: {
    importarCsv: (input: ImportarCsvInput) =>
      ipcRenderer.invoke(DADOS_IPC_CHANNELS.importarCsv, input),
    exportarMesCsv: (input: ExportarMesInput) =>
      ipcRenderer.invoke(DADOS_IPC_CHANNELS.exportarMesCsv, input),
    exportarMesPdf: (input: ExportarMesInput) =>
      ipcRenderer.invoke(DADOS_IPC_CHANNELS.exportarMesPdf, input)
  }
})
