import { createContext, useContext } from 'react'

/**
 * Contexto e hook do Toast, separados do componente de proposito.
 *
 * O `react-refresh/only-export-components` reclamava do `ToastProvider.tsx`
 * porque o arquivo exportava um componente e mais duas coisas que nao sao
 * componente (`useToast` e `ToastKind`). Nesse arranjo o Fast Refresh nao
 * consegue preservar o estado ao salvar o arquivo: ele desiste e remonta a
 * arvore inteira — e a arvore inteira, aqui, e o app, porque o provider
 * envolve o `<App />`.
 *
 * Era o unico warning do lint do projeto.
 */
export type ToastKind = 'success' | 'error' | 'info'

export type ToastContextValue = {
  show: (message: string, kind?: ToastKind) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return ctx
}
