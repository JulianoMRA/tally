import { useNavigate } from 'react-router-dom'
import type { FaturaResumida } from '@shared/ipc/visao-mensal'
import { Badge, EmptyState, Panel } from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import { formatarDiaMes } from '../../lib/formatar-data'
import { pluralizar } from '../../lib/pluralizar'
import { buildFaturasSearch } from '../faturas/faturas-search'
import { statusVariant } from '../faturas/status-variant'
import styles from './visao-mensal.module.css'

type Props = {
  faturas: FaturaResumida[]
}

export function FaturasCardCompacto({ faturas }: Props) {
  const navigate = useNavigate()

  return (
    <Panel
      title="Faturas"
      meta={`${faturas.length} ${pluralizar('cartão', faturas.length, 'ões')}`}
      flush
      className={styles.panel}
    >
      {faturas.length === 0 ? (
        <EmptyState title="Nenhuma fatura neste mês." />
      ) : (
        <ul className={styles.faturaCompactaList}>
          {faturas.map((f) => (
            <li key={f.fatura.id} className={styles.faturaCompactaItem}>
              <span className={styles.cardChip} style={{ background: f.cartaoCor }} />
              <button
                type="button"
                className={styles.faturaCompactaNome}
                onClick={() =>
                  navigate(`/faturas?${buildFaturasSearch(f.fatura.cartaoId, f.fatura.id)}`)
                }
                title="Abrir fatura"
              >
                {f.cartaoNome}
              </button>
              <span className={styles.faturaCompactaVence}>
                vence {formatarDiaMes(f.fatura.dataVencimento)}
              </span>
              <span className={`${styles.faturaCompactaTotal} tnum`}>
                {formatBRL(f.totalCentavos)}
              </span>
              <Badge variant={statusVariant(f.fatura.status.kind)} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
