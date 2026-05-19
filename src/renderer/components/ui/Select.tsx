import { forwardRef, type SelectHTMLAttributes } from 'react'
import styles from './select.module.css'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { error, className, children, ...rest },
  ref
) {
  const cls = [styles.select, error ? styles.error : '', className].filter(Boolean).join(' ')
  return (
    <select ref={ref} className={cls} {...rest}>
      {children}
    </select>
  )
})
