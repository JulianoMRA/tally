import type { ReactNode } from 'react'
import { Button } from './Button'
import { useEscapeKey } from '../../hooks/use-escape-key'
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
 * destrutivas. Fecha com Esc (delega ao `useEscapeKey`).
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
  useEscapeKey(onCancel)
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.body}>{body}</p>
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
