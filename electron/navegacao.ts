/**
 * Decisões de navegação da janela, isoladas do Electron de propósito.
 *
 * São guardas de fronteira: quem as viola carrega conteúdo arbitrário NA
 * janela que mantém o preload, ou seja, com `window.api` inteiro ao alcance.
 * Sem dependência de `electron`, elas rodam em teste unitário — a camada
 * `electron/` não tinha nenhum até agosto de 2026.
 */

/**
 * Uma navegação é interna quando aponta para o MESMO documento que a janela já
 * carrega. Só o fragmento pode mudar, que é exatamente o caso do roteador do
 * app (`createHashRouter`).
 *
 * Compara protocolo, host e caminho separadamente em vez de usar `origin`
 * porque **a origem de toda URL `file:` é a string `'null'`**: dois arquivos
 * diferentes do disco têm origens iguais, e comparar por ela deixaria passar
 * qualquer caminho local. Também não compara por prefixo — a guarda anterior
 * fazia `startsWith`, e `http://localhost:5173.exemplo.invalido` começa com
 * `http://localhost:5173`.
 *
 * `urlAtual` vazia (janela ainda sem página) recusa tudo. Antes essa condição
 * virava `startsWith('')`, verdadeiro para qualquer string — a guarda inteira
 * desaparecia no momento em que ela mais deveria valer.
 *
 * O caminho é comparado byte a byte, e no Windows o sistema de arquivos não
 * diferencia maiúsculas. Uma navegação para o mesmo arquivo escrito com outra
 * caixa é recusada; o erro cai para o lado seguro e nenhum fluxo do app produz
 * essa URL — quem carrega o documento é o main, com o caminho que ele montou.
 */
export function ehNavegacaoInterna(urlAtual: string, urlDestino: string): boolean {
  if (urlAtual.length === 0) return false

  let atual: URL
  let destino: URL
  try {
    atual = new URL(urlAtual)
    destino = new URL(urlDestino)
  } catch {
    return false
  }

  return (
    destino.protocol === atual.protocol &&
    destino.host === atual.host &&
    destino.pathname === atual.pathname
  )
}

/**
 * Devolve a URL a abrir no navegador do SO, ou null se ela não for http(s).
 *
 * `new URL()` rejeita string malformada, e a comparação exata de protocolo
 * barra esquema perigoso — `javascript:`, `file:`, `data:` e os handlers de
 * protocolo do Windows — que um `startsWith('http')` deixaria passar.
 */
export function urlExternaPermitida(rawUrl: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  return parsed.href
}
