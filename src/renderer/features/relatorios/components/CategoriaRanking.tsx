import type { TotalPorCategoria } from '@shared/ipc/relatorio'
import { formatBRL } from '../../../lib/format-brl'
import styles from '../relatorios.module.css'

type Props = { dados: TotalPorCategoria[] }

export function CategoriaRanking({ dados }: Props) {
  const total = dados.reduce((s, d) => s + d.totalCentavos, 0)
  return (
    <ol className={styles.ranking}>
      {dados.map((d) => {
        const pct = total > 0 ? Math.round((d.totalCentavos / total) * 100) : 0
        return (
          <li key={d.categoriaId} className={styles.rankItem}>
            <span className={styles.rankChip} style={{ background: d.cor }} />
            <span className={styles.rankNome}>{d.categoriaNome}</span>
            <span className={styles.rankValor}>{formatBRL(d.totalCentavos)}</span>
            <span className={styles.rankPct}>{pct}%</span>
          </li>
        )
      })}
    </ol>
  )
}
