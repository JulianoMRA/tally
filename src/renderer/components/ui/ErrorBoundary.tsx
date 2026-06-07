import { useRouteError } from 'react-router-dom'
import { EmptyState } from './EmptyState'
import { Button } from './Button'
import styles from './error-boundary.module.css'

function extrairMensagem(error: unknown): string | undefined {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return undefined
}

/**
 * Tela de erro apresentacional (sem dependência de roteamento), reutilizável e
 * testável isoladamente. Mostra uma mensagem amigável, tranquiliza sobre os
 * dados e oferece o recarregamento do app.
 */
export function ErrorScreen({ detalhe }: { detalhe?: string }) {
  return (
    <div className={styles.container} role="alert">
      <EmptyState
        title="Algo deu errado"
        description="Ocorreu um erro inesperado ao renderizar esta tela. Recarregue o aplicativo para continuar — seus dados continuam salvos."
        action={
          <Button variant="primary" onClick={() => window.location.reload()}>
            Recarregar
          </Button>
        }
      />
      {detalhe && <pre className={styles.detalhe}>{detalhe}</pre>}
    </div>
  )
}

/**
 * `errorElement` da rota raiz: captura qualquer erro de renderização das páginas
 * (e do próprio shell) e troca o "tela branca" por uma tela amigável. Substitui
 * a tela de erro padrão (em inglês) do react-router data router.
 */
export function RouteErrorBoundary() {
  const error = useRouteError()
  return <ErrorScreen detalhe={extrairMensagem(error)} />
}
