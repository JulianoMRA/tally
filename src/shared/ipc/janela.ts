import { JANELA_IPC_CHANNELS } from './channels'

export { JANELA_IPC_CHANNELS }

export type JanelaApi = {
  minimizar: () => Promise<void>
  alternarMaximizada: () => Promise<void>
  fechar: () => Promise<void>
  estaMaximizada: () => Promise<boolean>
  /**
   * Assina as mudanças de estado da janela. Devolve a função de cancelamento —
   * o preload nunca expõe o `ipcRenderer`, só esta assinatura.
   */
  aoMudarEstado: (ouvinte: (maximizada: boolean) => void) => () => void
  /**
   * `true` onde a barra desenha os próprios controles (Windows). Em Linux a
   * moldura nativa permanece e os três botões não são renderizados.
   */
  controlesProprios: boolean
}
