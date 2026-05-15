import type { HTMLAttributes, ReactNode } from 'react'
import styles from './panel.module.css'

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  meta?: ReactNode
  actions?: ReactNode
  flush?: boolean
}

export function Panel({
  title,
  meta,
  actions,
  flush = false,
  className,
  children,
  ...rest
}: PanelProps) {
  const bodyClass = [styles.body, flush ? styles.flush : ''].filter(Boolean).join(' ')

  return (
    <div className={[styles.panel, className].filter(Boolean).join(' ')} {...rest}>
      <div className={styles.head}>
        <h3 className={styles.title}>{title}</h3>
        {meta && <span className={styles.meta}>{meta}</span>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      <div className={bodyClass}>{children}</div>
    </div>
  )
}
