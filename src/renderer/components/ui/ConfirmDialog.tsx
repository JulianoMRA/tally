import { useId, type ReactNode } from 'react'
import { Button } from './Button'
import { useEscapeKey } from '../../hooks/use-escape-key'
import { useFocusTrap } from '../../hooks/use-focus-trap'
import styles from './confirm-dialog.module.css'

type Props = {
  title: string
  body: ReactNode
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'primary' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Modal de confirmação reusável. Substitui `window.confirm` em ações
 * destrutivas. Fecha com Esc (delega ao `useEscapeKey`). aria-labelledby
 * usa useId() para que multiplos ConfirmDialog simultaneos nao colidam.
 *
 * O foco entra no diálogo ao abrir e volta ao gatilho ao fechar (`useFocusTrap`).
 * Quando a confirmação é destrutiva, clicar no overlay **não** fecha: era fácil
 * demais descartar por engano um diálogo de exclusão irreversível.
 */
export function ConfirmDialog({
  title,
  body,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmVariant = 'primary',
  onConfirm,
  onCancel
}: Props) {
  const titleId = useId()
  const bodyId = useId()
  const dialogRef = useFocusTrap<HTMLDivElement>()
  useEscapeKey(onCancel)

  const fechaNoOverlay = confirmVariant !== 'danger'

  return (
    <div className={styles.overlay} onClick={fechaNoOverlay ? onCancel : undefined}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p id={bodyId} className={styles.body}>
          {body}
        </p>
        <div className={styles.actions}>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant={confirmVariant} size="sm" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
