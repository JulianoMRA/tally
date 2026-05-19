import { forwardRef, type InputHTMLAttributes } from 'react'
import styles from './input.module.css'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, className, ...rest },
  ref
) {
  const cls = [styles.input, error ? styles.error : '', className].filter(Boolean).join(' ')
  return <input ref={ref} className={cls} {...rest} />
})
