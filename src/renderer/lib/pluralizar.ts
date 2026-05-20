/**
 * Devolve `palavra` no singular quando `n === 1`, ou no plural concatenado com
 * `sufixoPlural`. Default 's'. Use sufixos próprios para palavras irregulares.
 *
 * Ex.: pluralizar('cartão', 2, 'ões') → 'cartões' (não 'cartãoões')
 */
export function pluralizar(palavra: string, n: number, sufixoPlural = 's'): string {
  if (n === 1) return palavra
  // Para sufixos que substituem letras finais (ex. 'ão' → 'ões'),
  // o chamador deve passar a palavra-base ('cart') + sufixos completos.
  // Aqui assumimos concatenação simples por padrão (substantivos regulares).
  if (sufixoPlural === 'ões') {
    // remove 'ão' final, concatena 'ões'
    return palavra.replace(/ão$/, 'ões')
  }
  return `${palavra}${sufixoPlural}`
}
