import type { ReactNode } from 'react'
import styles from './page-container.module.css'

interface PageContainerProps {
  children: ReactNode
}

/**
 * Container de página. Uma largura para todas as telas.
 *
 * Eram três tiers (`narrow` 760, `default` 1200, `wide` 1760) e um par
 * trilho/bloco cuja única razão de existir era impedir que tiers diferentes
 * fizessem cada rota começar num x diferente. Com uma largura só o problema
 * some por construção, e o par vira cerimônia — sobra um elemento.
 *
 * `data-page` existe para ser observável: o vitest roda com `css: false`, então
 * CSS Module vira string vazia e a classe não serve de asserção. Também dá ao
 * Playwright uma âncora estável para medir largura e posição da página.
 */
export function PageContainer({ children }: PageContainerProps) {
  return (
    <div className={styles.page} data-page="">
      {children}
    </div>
  )
}
