import type { SelectHTMLAttributes } from 'react'
import styles from './select.module.css'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export function Select({ error, className, children, ...rest }: SelectProps) {
  const cls = [styles.select, error ? styles.error : '', className].filter(Boolean).join(' ')
  return (
    <select className={cls} {...rest}>
      {children}
    </select>
  )
}
