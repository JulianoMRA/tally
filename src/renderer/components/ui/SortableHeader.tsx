import type { Direcao } from '../../lib/use-ordenacao'
import styles from './sortable-header.module.css'

interface SortableHeaderProps {
  rotulo: string
  /** Se esta é a coluna pela qual a tabela está ordenada agora. */
  ativo: boolean
  direcao: Direcao
  onSort: () => void
  /** Classe da célula, para alinhamento e largura definidos pela feature. */
  className?: string
}

/**
 * Cabeçalho de coluna ordenável.
 *
 * Antes era um `<th onClick>` com `cursor: pointer` e nada mais: sem `role`,
 * sem `tabIndex`, sem `aria-sort` e sem handler de teclado — ordenar era uma
 * função exclusiva de mouse em Saídas, Visão mensal e no detalhe da fatura. O
 * gate axe não pegava porque `<th>` clicável não viola nenhuma regra: só deixa
 * a funcionalidade inalcançável.
 *
 * O `<button>` interno traz Enter e Espaço de graça, e `aria-sort` na célula
 * informa a leitores de tela por qual coluna e em que sentido a tabela está.
 */
export function SortableHeader({ rotulo, ativo, direcao, onSort, className }: SortableHeaderProps) {
  return (
    <th
      scope="col"
      className={[styles.th, className].filter(Boolean).join(' ')}
      aria-sort={ativo ? (direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className={styles.botao} onClick={onSort}>
        {rotulo}
        {/* Só na coluna ativa: reservar espaço fixo em todas engordava a tabela
            de parcelas o suficiente para transbordar o painel em 1280px. */}
        {ativo && (
          <span aria-hidden="true" className={styles.indicador}>
            {direcao === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
    </th>
  )
}
