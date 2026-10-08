/**
 * Para onde a tecla leva dentro de um grupo de escolha única (`radiogroup` ou
 * `tablist`), no padrão WAI-ARIA: as setas andam e dão a volta nas pontas, Home
 * e End vão às pontas. `null` quando a tecla não navega, para quem chama deixar
 * o evento seguir.
 */
export function indiceDaTecla(tecla: string, atual: number, total: number): number | null {
  if (total === 0) return null
  switch (tecla) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (atual + 1) % total
    case 'ArrowLeft':
    case 'ArrowUp':
      return (atual - 1 + total) % total
    case 'Home':
      return 0
    case 'End':
      return total - 1
    default:
      return null
  }
}
