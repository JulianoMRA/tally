/**
 * Erros lançados em handlers IPC chegam ao renderer embrulhados pelo Electron:
 * "Error invoking remote method 'canal:metodo': Error: <mensagem original>".
 * Este helper extrai a mensagem original para exibição em toasts.
 */
const PREFIXO_IPC = /^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/

/** Um issue de ZodError, do jeito que sobrevive à serialização do IPC. */
type IssueZod = { message: string; path?: unknown[] }

function ehIssueZod(valor: unknown): valor is IssueZod {
  if (typeof valor !== 'object' || valor === null) return false
  const candidato = valor as { message?: unknown; path?: unknown }
  if (typeof candidato.message !== 'string' || candidato.message.length === 0) return false
  return candidato.path === undefined || Array.isArray(candidato.path)
}

/**
 * Traduz o corpo de um ZodError serializado para uma linha legível, ou null se
 * o texto não for isso.
 *
 * Os handlers do main validam com `.parse()`, e no zod v4 a `message` do
 * ZodError é o JSON completo dos issues — com `code`, `origin`, `note` e o
 * resto do diagnóstico. Como o `mensagemErro` repassa o que sobra ao toast,
 * qualquer divergência entre a validação do formulário e a do main aparecia
 * para o usuário como um despejo de JSON de várias linhas.
 *
 * Não há corrupção de dado nesses casos — o main rejeitou, que é o correto —,
 * mas a mensagem não dizia o que houve. A maioria dos schemas do projeto já
 * traz mensagem em português ('Valor deve ser maior que zero'); o que faltava
 * era extraí-la.
 *
 * O caminho do campo entra como prefixo porque, com vários issues, saber qual
 * campo reclamou é metade da informação.
 */
function formatarIssuesZod(texto: string): string | null {
  const aparado = texto.trim()
  if (!aparado.startsWith('[')) return null

  let bruto: unknown
  try {
    bruto = JSON.parse(aparado)
  } catch {
    return null
  }
  if (!Array.isArray(bruto) || bruto.length === 0) return null
  if (!bruto.every(ehIssueZod)) return null

  return bruto
    .map((issue) => {
      const caminho = (issue.path ?? []).join('.')
      return caminho.length > 0 ? `${caminho}: ${issue.message}` : issue.message
    })
    .join('; ')
}

export function mensagemErro(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback
  const mensagem = e.message.replace(PREFIXO_IPC, '').trim()
  if (mensagem.length === 0) return fallback
  return formatarIssuesZod(mensagem) ?? mensagem
}
