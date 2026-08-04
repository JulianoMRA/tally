import type { KeyboardEvent } from 'react'

/**
 * Handler de teclado para elementos com `role="button"`.
 *
 * O padrão WAI-ARIA de botão exige Enter **e** Espaço; os itens de fatura só
 * tratavam Enter. O `preventDefault` no Espaço evita que a tecla role a página
 * antes de a ação acontecer, que é o comportamento default do navegador quando
 * o elemento não é um `<button>` de verdade.
 */
export function aoTeclarComoBotao(acao: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    acao()
  }
}
