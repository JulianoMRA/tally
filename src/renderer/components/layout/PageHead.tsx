import type { ReactNode } from 'react'
import styles from './page-head.module.css'

interface PageHeadProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHead({ title, subtitle, actions }: PageHeadProps) {
  return (
    <div className={styles.head}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
