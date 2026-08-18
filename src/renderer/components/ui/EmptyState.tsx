import type { ReactNode } from 'react'
import styles from './empty-state.module.css'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  /**
   * Reduz o bloco a uma nota de duas linhas.
   *
   * O estado cheio existe para lista vazia que ocupa a tela — ali os 48px de
   * respiro são o que impede a página de parecer quebrada. Dentro de um painel
   * que é só uma parte da tela ele vira desperdício: em Ajustes e em Importar,
   * dizer "ainda não há nada aqui" custava ~250px de altura e empurrava o botão
   * de salvar para fora da dobra.
   */
  compacto?: boolean
}

export function EmptyState({ title, description, action, compacto = false }: EmptyStateProps) {
  return (
    <div className={`${styles.root} ${compacto ? styles.compacto : ''}`}>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
