/**
 * Erros lançados em handlers IPC chegam ao renderer embrulhados pelo Electron:
 * "Error invoking remote method 'canal:metodo': Error: <mensagem original>".
 * Este helper extrai a mensagem original para exibição em toasts.
 */
const PREFIXO_IPC = /^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/

export function mensagemErro(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback
  const mensagem = e.message.replace(PREFIXO_IPC, '').trim()
  return mensagem.length > 0 ? mensagem : fallback
}
