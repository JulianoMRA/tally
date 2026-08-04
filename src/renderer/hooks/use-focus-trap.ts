import { useEffect, useRef } from 'react'

const FOCAVEIS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

// Sem filtro de visibilidade: o seletor já exclui `[disabled]` e
// `tabindex="-1"`, e checar `offsetParent`/`getClientRects` dependeria de
// layout — sempre zerado em jsdom, o que tornaria o hook não-testável e
// esconderia focáveis legítimos como o input transparente do FileDropzone.
function focaveis(raiz: HTMLElement): HTMLElement[] {
  return [...raiz.querySelectorAll<HTMLElement>(FOCAVEIS)]
}

/**
 * Prende o foco dentro de um modal enquanto ele está aberto.
 *
 * Sem isto, o `ConfirmDialog` abria e o foco continuava no botão da linha que o
 * disparou — medido em runtime: `document.activeElement` ficava FORA do diálogo,
 * e o Tab caminhava pela página atrás do overlay. Num diálogo de exclusão
 * irreversível, quem navega por teclado ou leitor de tela não tinha como saber
 * que havia uma pergunta na tela.
 *
 * Ao montar, move o foco para o primeiro elemento focável (ou para o próprio
 * container, se não houver nenhum); ao desmontar, devolve o foco para quem
 * abriu o modal.
 */
export function useFocusTrap<T extends HTMLElement>() {
  const containerRef = useRef<T>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const anterior = document.activeElement as HTMLElement | null
    const alvos = focaveis(container)
    if (alvos.length > 0) {
      alvos[0].focus()
    } else {
      container.tabIndex = -1
      container.focus()
    }

    function aoTeclar(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !container) return
      const lista = focaveis(container)
      if (lista.length === 0) {
        e.preventDefault()
        return
      }
      const primeiro = lista[0]
      const ultimo = lista[lista.length - 1]
      const atual = document.activeElement

      // Ciclo: Tab no último volta ao primeiro, Shift+Tab no primeiro vai ao
      // último. Se o foco escapou do container, traz de volta.
      if (!container.contains(atual)) {
        e.preventDefault()
        primeiro.focus()
        return
      }
      if (!e.shiftKey && atual === ultimo) {
        e.preventDefault()
        primeiro.focus()
      } else if (e.shiftKey && atual === primeiro) {
        e.preventDefault()
        ultimo.focus()
      }
    }

    document.addEventListener('keydown', aoTeclar, true)
    return () => {
      document.removeEventListener('keydown', aoTeclar, true)
      anterior?.focus?.()
    }
  }, [])

  return containerRef
}
