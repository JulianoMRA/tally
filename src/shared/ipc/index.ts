export { APP_IPC_CHANNELS, type AppApi } from './app'
export { JANELA_IPC_CHANNELS, type JanelaApi } from './janela'

export {
  cartaoInputSchema,
  corHexSchema,
  CARTAO_IPC_CHANNELS,
  type CartaoInput,
  type ListCartaoOptions,
  type CartaoApi
} from './cartao'

export {
  categoriaInputSchema,
  CATEGORIA_IPC_CHANNELS,
  type CategoriaInput,
  type ListCategoriaOptions,
  type CategoriaApi
} from './categoria'

export {
  despesaUnicaCreditoInputSchema,
  DESPESA_IPC_CHANNELS,
  type DespesaUnicaCreditoInput,
  type ResultadoCriarDespesa,
  type DespesaApi
} from './despesa'

export { FATURA_IPC_CHANNELS, type FaturaDetalhada, type FaturaApi } from './fatura'

export {
  RENDA_IPC_CHANNELS,
  type CriarRendaRecorrenteInput,
  type UpdateRendaInput,
  type ListRendaOptions,
  type RendaApi
} from './renda'

export {
  RECEBIMENTO_IPC_CHANNELS,
  type CriarRecebimentoAvulsoInput,
  type AtualizarRecebimentoInput,
  type MarcarRecebidoInput,
  type ExcluirRecebimentoInput,
  type ListarRecebimentosInput,
  type RecebimentoComContexto,
  type RecebimentoApi
} from './recebimento'

export {
  VISAO_MENSAL_IPC_CHANNELS,
  type DetalharMesInput,
  type FaturaResumida,
  type VisaoMensalDetalhada,
  type VisaoMensalApi
} from './visao-mensal'

export {
  SIMULACAO_IPC_CHANNELS,
  simulacaoDoMesSchema,
  obterSimulacaoInputSchema,
  salvarSimulacaoInputSchema,
  SIMULACAO_VAZIA,
  MAX_ITENS_SIMULACAO,
  MAX_REPETICOES_SIMULACAO,
  MAX_DESCRICAO_SIMULACAO,
  type ObterSimulacaoInput,
  type SalvarSimulacaoInput,
  type SimulacaoApi
} from './simulacao'

export {
  RELATORIO_IPC_CHANNELS,
  type TotaisPorCategoriaInput,
  type EvolucaoSaldoInput,
  type EvolucaoCategoriaInput,
  type TotalPorCategoria,
  type PontoEvolucaoSaldo,
  type PontoEvolucaoCategoria,
  type RelatorioApi
} from './relatorio'

export {
  ORCAMENTO_IPC_CHANNELS,
  definirLimiteInputSchema,
  listarProgressoInputSchema,
  type DefinirLimiteInput,
  type ListarProgressoInput,
  type OrcamentoApi
} from './orcamento'

export {
  CONFIG_IPC_CHANNELS,
  configSchema,
  CONFIG_DEFAULTS,
  type Config,
  type ConfigApi,
  type TemaApi,
  type Tema
} from './config'

export {
  DADOS_IPC_CHANNELS,
  linhaImportacaoSchema,
  importarCsvInputSchema,
  type LinhaImportacao,
  type TipoImportacao,
  type ImportarCsvInput,
  type ResultadoImportacao,
  type DadosApi
} from './importacao'

import type { CartaoApi } from './cartao'
import type { CategoriaApi } from './categoria'
import type { DespesaApi } from './despesa'
import type { FaturaApi } from './fatura'
import type { RendaApi } from './renda'
import type { RecebimentoApi } from './recebimento'
import type { VisaoMensalApi } from './visao-mensal'
import type { RelatorioApi } from './relatorio'
import type { SimulacaoApi } from './simulacao'
import type { OrcamentoApi } from './orcamento'
import type { ConfigApi, TemaApi } from './config'
import type { DadosApi } from './importacao'
import type { AppApi } from './app'
import type { JanelaApi } from './janela'

export type Api = {
  cartao: CartaoApi
  categoria: CategoriaApi
  despesa: DespesaApi
  fatura: FaturaApi
  renda: RendaApi
  recebimento: RecebimentoApi
  visaoMensal: VisaoMensalApi
  relatorio: RelatorioApi
  simulacao: SimulacaoApi
  orcamento: OrcamentoApi
  config: ConfigApi
  tema: TemaApi
  dados: DadosApi
  app: AppApi
  janela: JanelaApi
}
