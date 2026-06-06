import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import styles from './field.module.css'

interface FieldProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}

// Associa o <label> ao controle via htmlFor/id. Se o controle (único elemento
// filho) já tiver um id, ele é preservado; senão recebe o id gerado. Sem essa
// associação o label fica solto — quebra leitores de tela e seletores por label.
export function Field({ label, error, hint, required, children }: FieldProps) {
  const generatedId = useId()
  const childId =
    isValidElement(children) && (children.props as { id?: string }).id
      ? (children.props as { id?: string }).id
      : generatedId
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, { id: childId })
    : children

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={childId}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>
      {control}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  )
}
