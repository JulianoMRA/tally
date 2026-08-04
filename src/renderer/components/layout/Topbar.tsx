import type { ReactNode } from 'react'
import styles from './topbar.module.css'

interface TopbarProps {
  title: string
  actions?: ReactNode
}

/**
 * Barra fixa no topo da área rolável, com o título da página e as ações dela.
 *
 * Até a fase 5 do plano de UI/UX este componente existia, estava documentado no
 * design system e não era importado por ninguém — e, por isso, nenhuma tela
 * mantinha título ou ações visíveis durante a rolagem. É consumido pelo
 * `PageHead`, que continua sendo a API das páginas.
 */
export function Topbar({ title, actions }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <h1 className={styles.title}>{title}</h1>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
