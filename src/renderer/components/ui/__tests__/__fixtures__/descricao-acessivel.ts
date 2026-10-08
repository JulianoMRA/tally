/**
 * O texto para o qual `aria-describedby` aponta: a descrição acessível do
 * elemento. É por ela que o item indisponível do menu diz por quê.
 */
export function descricaoAcessivel(el: Element): string {
  return (el.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
}
