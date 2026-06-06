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
  excluir: 'despesa:excluir',
  atualizar: 'despesa:atualizar'
} as const

export const FATURA_IPC_CHANNELS = {
  listarPorCartao: 'fatura:listarPorCartao',
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
