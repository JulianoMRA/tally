import type { ReactNode } from 'react'
import styles from './topbar.module.css'

interface TopbarProps {
  breadcrumb?: string
  actions?: ReactNode
}

export function Topbar({ breadcrumb, actions }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.crumbs}>
        {breadcrumb && <span className={styles.current}>{breadcrumb}</span>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
