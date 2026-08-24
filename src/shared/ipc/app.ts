import { APP_IPC_CHANNELS } from './channels'

export { APP_IPC_CHANNELS }

/**
 * Nenhuma ação recebe argumento: todas abrem diálogo nativo e resolvem por lá,
 * então não há schema Zod a validar — o que chega do renderer é só o disparo.
 */
export type AppApi = {
  exportarDados: () => Promise<void>
  importarDados: () => Promise<void>
  verificarAtualizacoes: () => Promise<void>
  sair: () => Promise<void>
}
