import type { ReactNode } from 'react'
import { Topbar } from './Topbar'
import styles from './page-head.module.css'

interface PageHeadProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

/**
 * Cabeçalho de página: barra fixa com título e ações (via `Topbar`), mais o
 * subtítulo, que rola junto com o conteúdo por ser texto de referência — grudar
 * as três linhas custaria ~90px de altura fixa numa janela de 800px.
 */
export function PageHead({ title, subtitle, actions }: PageHeadProps) {
  return (
    <>
      <Topbar title={title} actions={actions} />
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </>
  )
}
