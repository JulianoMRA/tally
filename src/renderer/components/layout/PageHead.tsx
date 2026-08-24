import type { ReactNode } from 'react'
import styles from './page-head.module.css'

interface PageHeadProps {
  /**
   * Nome da tela. **Não é mais renderizado aqui** — o `h1` vive na barra de
   * título, alimentado por `handle.titulo` da rota. A prop fica na API porque
   * as oito telas a passam e ela documenta, no próprio arquivo da página, de
   * quem é aquele cabeçalho.
   *
   * Quem impede os dois de divergirem é `titulos-de-rota.test.ts`, e não um
   * aviso em runtime: ler a rota daqui obrigaria toda página a ser testada
   * dentro de um roteador, o que quebrou quatro testes de `AjustesPage`.
   */
  title: string
  subtitle?: string
  actions?: ReactNode
}

/**
 * Linha de apoio da página: subtítulo à esquerda, ações à direita.
 *
 * Era uma barra fixa com o título (via `Topbar`) mais o subtítulo abaixo. O
 * título subiu para a barra de título da janela, e com ele foi embora o
 * `Topbar` — as duas faixas de cromo viraram uma.
 *
 * **Consequência assumida:** as ações da página não acompanham mais a rolagem.
 * O título, sim — está na janela agora, sempre visível.
 */
export function PageHead({ subtitle, actions }: PageHeadProps) {
  if (!subtitle && !actions) return null

  return (
    <div className={styles.linha}>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
