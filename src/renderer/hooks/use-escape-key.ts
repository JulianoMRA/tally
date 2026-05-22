import { useEffect } from 'react'

/**
 * Chama `handler` quando o usuário pressiona Esc. Útil para fechar modais.
 * Listener é global e desregistra no unmount.
 */
export function useEscapeKey(handler: () => void): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handler])
}
