import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import styles from './toast.module.css'

export type ToastKind = 'success' | 'error' | 'info'

type Toast = {
  id: number
  message: string
  kind: ToastKind
}

type ToastContextValue = {
  show: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION_MS = 3000
// Erro fica mais tempo: costuma trazer a mensagem do IPC, que é mais longa do
// que "Cartão criado." e o usuário precisa conseguir ler antes de sumir.
const ERRO_DURATION_MS = 7000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextIdRef = useRef(1)
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const timersPorToast = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dispensar = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const agendarSaida = useCallback(
    (id: number, ms: number) => {
      const handle = setTimeout(() => {
        dispensar(id)
        timersRef.current.delete(handle)
      }, ms)
      timersRef.current.add(handle)
      timersPorToast.current.set(id, handle)
    },
    [dispensar]
  )

  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextIdRef.current++
      setToasts((prev) => [...prev, { id, message, kind }])
      agendarSaida(id, kind === 'error' ? ERRO_DURATION_MS : DEFAULT_DURATION_MS)
    },
    [agendarSaida]
  )

  // Pausa a contagem enquanto o ponteiro está sobre o toast: sem isso a
  // mensagem sumia embaixo do cursor de quem estava lendo.
  const pausar = useCallback((id: number) => {
    const handle = timersPorToast.current.get(id)
    if (handle === undefined) return
    clearTimeout(handle)
    timersRef.current.delete(handle)
    timersPorToast.current.delete(id)
  }, [])

  const retomar = useCallback(
    (id: number, kind: ToastKind) => {
      if (timersPorToast.current.has(id)) return
      agendarSaida(id, kind === 'error' ? ERRO_DURATION_MS : DEFAULT_DURATION_MS)
    },
    [agendarSaida]
  )

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const handle of timers) clearTimeout(handle)
      timers.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className={styles.container}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${styles[t.kind]}`}
            // Erro interrompe a leitura (`alert`); sucesso e info entram na fila
            // educada (`status`). Antes tudo era `status`, então uma falha de
            // IPC podia passar despercebida por quem usa leitor de tela.
            role={t.kind === 'error' ? 'alert' : 'status'}
            aria-live={t.kind === 'error' ? 'assertive' : 'polite'}
            onMouseEnter={() => pausar(t.id)}
            onMouseLeave={() => retomar(t.id, t.kind)}
            onFocus={() => pausar(t.id)}
            onBlur={() => retomar(t.id, t.kind)}
          >
            <span className={styles.mensagem}>{t.message}</span>
            <button
              type="button"
              className={styles.fechar}
              aria-label="Fechar aviso"
              onClick={() => dispensar(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return ctx
}
