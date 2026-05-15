import type { InputHTMLAttributes } from 'react'
import styles from './input.module.css'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ error, className, ...rest }: InputProps) {
  const cls = [styles.input, error ? styles.error : '', className].filter(Boolean).join(' ')
  return <input className={cls} {...rest} />
}
