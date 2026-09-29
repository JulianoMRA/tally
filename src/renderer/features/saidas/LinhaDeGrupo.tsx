import { formatBRL } from '../../lib/format-brl'
import styles from './saidas.module.css'

type Props = {
  rotulo: string
  /** Cor da bolinha. Ausente em "Fora do cartão", que não tem cor própria. */
  cor?: string
  totalCentavos: number
  /** Quantas colunas vêm antes da de valor: é a largura do rótulo. */
  colunasDoRotulo: number
}

/**
 * Cabeçalho de seção da tabela de Saídas.
 *
 * O subtotal tem célula própria, na coluna de valor. Antes ele dividia uma
 * célula de linha inteira com o rótulo e encostava na borda da tabela, depois
 * da coluna de ações: a tela tinha uma borda para os valores das linhas e
 * outra para os subtotais.
 *
 * É `<tr>` dentro da mesma tabela, e não uma lista separada, para os
 * `getByRole('cell')` da suíte E2E continuarem valendo.
 */
export function LinhaDeGrupo({ rotulo, cor, totalCentavos, colunasDoRotulo }: Props) {
  return (
    <tr className={styles.grupo}>
      <td colSpan={colunasDoRotulo}>
        <span className={styles.grupoRotulo}>
          {/* Sem cor, a bolinha continua ocupando o lugar: o texto de todos os
              grupos começa na mesma posição. */}
          <span
            aria-hidden="true"
            className={styles.bolinha}
            data-bolinha={cor ? 'cor' : 'vazia'}
            style={cor ? { background: cor } : undefined}
          />
          {rotulo}
        </span>
      </td>
      <td className={`${styles.colValor} ${styles.grupoTotal} tnum`}>{formatBRL(totalCentavos)}</td>
      <td />
    </tr>
  )
}
