import type { ReactNode } from 'react'
import styles from './page-container.module.css'

type PageWidth = 'narrow' | 'default' | 'wide'

interface PageContainerProps {
  /**
   * `narrow` para páginas de formulário único (Ajustes, Importar), `wide` para
   * as densas que ganham com espaço horizontal (Visão mensal, Saídas) e
   * `default` para o resto.
   */
  width?: PageWidth
  children: ReactNode
}

export function PageContainer({ width = 'default', children }: PageContainerProps) {
  // data-width existe para ser observável: o vitest roda com `css: false`, então
  // CSS Module vira string vazia e a classe não serve de asserção. Também dá ao
  // Playwright uma âncora estável para medir a largura efetiva da página.
  return (
    <div className={`${styles.container} ${styles[width]}`} data-width={width}>
      {children}
    </div>
  )
}
