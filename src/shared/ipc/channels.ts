// Constantes dos canais IPC, sem nenhuma dependência de runtime (zero zod).
//
// O preload importa SOMENTE deste módulo para que seu bundle não arraste zod —
// requisito para rodar com `sandbox: true` (um preload sandboxed não consegue
// `require('zod')`). Os módulos de schema (cartao.ts, despesa.ts, ...) re-exportam
// estas constantes, mantendo uma única fonte de verdade para os nomes de canal.

export const CARTAO_IPC_CHANNELS = {
  list: 'cartao:list',
  findById: 'cartao:findById',
  create: 'cartao:create',
  update: 'cartao:update',
  arquivar: 'cartao:arquivar',
  desarquivar: 'cartao:desarquivar'
} as const

export const CATEGORIA_IPC_CHANNELS = {
  list: 'categoria:list',
  findById: 'categoria:findById',
  create: 'categoria:create',
  update: 'categoria:update',
  arquivar: 'categoria:arquivar',
  desarquivar: 'categoria:desarquivar'
} as const

export const DESPESA_IPC_CHANNELS = {
  criarUnicaCredito: 'despesa:criar-unica-credito',
  criarParceladaCredito: 'despesa:criar-parcelada-credito',
  criarParceladaEmAndamento: 'despesa:criar-parcelada-em-andamento',
  adiantarParcelas: 'despesa:adiantar-parcelas',
  cancelarPendentes: 'despesa:cancelar-pendentes',
  criarAssinaturaCredito: 'despesa:criar-assinatura-credito',
  cancelarAssinatura: 'despesa:cancelar-assinatura',
  reajustarValorMensalAssinatura: 'despesa:reajustar-valor-mensal-assinatura',
  listarAssinaturas: 'despesa:listar-assinaturas',
  criarUnicaForaCartao: 'despesa:criar-unica-fora-cartao',
  listarGastosForaCartao: 'despesa:listar-gastos-fora-cartao',
  listarDespesas: 'despesa:listar-despesas',
  listarComTags: 'despesa:listar-com-tags',
  listarOcorrenciasDoMes: 'despesa:listar-ocorrencias-do-mes',
  listarTags: 'despesa:listar-tags',
  excluir: 'despesa:excluir',
  atualizar: 'despesa:atualizar',
  definirNotaETags: 'despesa:definir-nota-e-tags'
} as const

export const FATURA_IPC_CHANNELS = {
  listarPorCartao: 'fatura:listarPorCartao',
  listarResumoPorCartao: 'fatura:listarResumoPorCartao',
  detalharComParcelas: 'fatura:detalharComParcelas',
  fechar: 'fatura:fechar',
  pagar: 'fatura:pagar',
  reabrir: 'fatura:reabrir'
} as const

export const RENDA_IPC_CHANNELS = {
  list: 'renda:list',
  findById: 'renda:findById',
  criarAvulsa: 'renda:criar-avulsa',
  criarRecorrente: 'renda:criar-recorrente',
  update: 'renda:update',
  arquivar: 'renda:arquivar',
  desarquivar: 'renda:desarquivar'
} as const

export const RECEBIMENTO_IPC_CHANNELS = {
  criarAvulso: 'recebimento:criar-avulso',
  listar: 'recebimento:listar',
  marcarRecebido: 'recebimento:marcar-recebido',
  excluir: 'recebimento:excluir'
} as const

export const VISAO_MENSAL_IPC_CHANNELS = {
  detalhar: 'visao-mensal:detalhar'
} as const

export const RELATORIO_IPC_CHANNELS = {
  totaisPorCategoria: 'relatorio:totaisPorCategoria',
  evolucaoSaldo: 'relatorio:evolucaoSaldo',
  evolucaoCategoria: 'relatorio:evolucaoCategoria'
} as const

export const ORCAMENTO_IPC_CHANNELS = {
  definirLimite: 'orcamento:definir-limite',
  removerLimite: 'orcamento:remover-limite',
  listarProgresso: 'orcamento:listar-progresso'
} as const

export const CONFIG_IPC_CHANNELS = {
  get: 'config:get',
  set: 'config:set',
  escolherPastaBackup: 'config:escolher-pasta-backup',
  listarBackups: 'config:listar-backups',
  criarBackupAgora: 'config:criar-backup-agora',
  restaurarBackup: 'config:restaurar-backup',
  abrirPastaBackups: 'config:abrir-pasta-backups'
} as const

export const DADOS_IPC_CHANNELS = {
  importarCsv: 'dados:importar-csv',
  exportarMesCsv: 'dados:exportar-mes-csv',
  exportarMesPdf: 'dados:exportar-mes-pdf'
} as const

/**
 * Ações de nível de aplicação que viviam no menu nativo "Arquivo". Com a barra
 * de título própria, a faixa de menu deixou de existir e o gatilho passou a ser
 * o renderer; os handlers continuam no main.
 */
export const APP_IPC_CHANNELS = {
  exportarDados: 'app:exportar-dados',
  importarDados: 'app:importar-dados',
  verificarAtualizacoes: 'app:verificar-atualizacoes',
  sair: 'app:sair'
} as const

/**
 * Controles de janela. Deixaram de ser nativos quando a barra de título passou a
 * ser do app, então minimizar, maximizar e fechar viram IPC.
 *
 * `mudouEstado` é o primeiro canal main → renderer do projeto: sem ele, maximizar
 * por duplo-clique na barra ou por Win+Seta dessincronizaria o glifo do botão.
 */
export const JANELA_IPC_CHANNELS = {
  minimizar: 'janela:minimizar',
  alternarMaximizada: 'janela:alternar-maximizada',
  fechar: 'janela:fechar',
  estaMaximizada: 'janela:esta-maximizada',
  mudouEstado: 'janela:mudou-estado'
} as const
