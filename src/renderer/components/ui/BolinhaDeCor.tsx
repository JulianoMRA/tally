import styles from './bolinha-de-cor.module.css'

type Props = {
  /** Ausente, a bolinha só reserva o lugar — o texto ao lado continua alinhado. */
  cor?: string
}

/**
 * Marcador de cor de cartão ou de categoria, antes do nome numa tabela.
 *
 * Nasceu na linha de grupo de Saídas, onde era um `span` vazio com largura e
 * altura mas sem `display` — elemento inline ignora as duas, e a bolinha nunca
 * foi desenhada. É decorativa: quem nomeia é o texto ao lado.
 */
export function BolinhaDeCor({ cor }: Props) {
  return (
    <span
      aria-hidden="true"
      className={styles.bolinha}
      data-bolinha={cor ? 'cor' : 'vazia'}
      style={cor ? { background: cor } : undefined}
    />
  )
}
