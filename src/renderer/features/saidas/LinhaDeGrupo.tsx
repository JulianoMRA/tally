import { Badge, BolinhaDeCor } from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import styles from './saidas.module.css'

type Props = {
  rotulo: string
  /** Cor da bolinha: do cartão ou da categoria. Ausente em "Fora do cartão". */
  cor?: string
  /** Categoria arquivada: o cabeçalho leva o selo (RF-CAT-02). */
  arquivada?: boolean
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
 * É `<tr>` dentro da mesma tabela, e não uma lista separada, para a coluna de
 * valor seguir alinhada entre as seções. `data-grupo` distingue o cabeçalho
 * das linhas: sem agrupamento por origem, o nome do cartão também aparece na
 * coluna Origem, e um `getByRole('cell')` pelo nome acharia os dois.
 */
export function LinhaDeGrupo({ rotulo, cor, arquivada, totalCentavos, colunasDoRotulo }: Props) {
  return (
    <tr className={styles.grupo} data-grupo="">
      <td colSpan={colunasDoRotulo}>
        <span className={styles.grupoRotulo}>
          <BolinhaDeCor cor={cor} />
          {rotulo}
          {arquivada && <Badge variant="archived" label="Arquivada" />}
        </span>
      </td>
      <td className={`${styles.colValor} ${styles.grupoTotal} tnum`}>{formatBRL(totalCentavos)}</td>
      <td />
    </tr>
  )
}
