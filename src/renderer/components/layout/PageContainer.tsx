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
  // Dois níveis de propósito: o trilho externo é idêntico em todas as telas e
  // define onde a página começa; o bloco interno carrega o tier e define até
  // onde ela vai. Ver o comentário do CSS para o defeito que isso corrige.
  //
  // data-width vive no bloco por ser ele quem tem o max-width, e existe para ser
  // observável: o vitest roda com `css: false`, então CSS Module vira string
  // vazia e a classe não serve de asserção. Também dá ao Playwright uma âncora
  // estável para medir largura e posição da página.
  return (
    <div className={styles.rail}>
      <div className={`${styles.block} ${styles[width]}`} data-width={width}>
        {children}
      </div>
    </div>
  )
}
