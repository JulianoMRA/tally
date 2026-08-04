import type { Cartao } from '@domain/entities/cartao'
import type { Fatura } from '@domain/entities/fatura'
import type { GrupoFaturasCartao } from './hooks/use-faturas'
import { Badge, EmptyState, Panel } from '../../components/ui'
import { formatarDataIso, formatarMesReferencia } from '../../lib/formatar-data'
import { pluralizar } from '../../lib/pluralizar'
import { statusVariant } from './status-variant'
import styles from './faturas.module.css'

type Props = {
  grupos: GrupoFaturasCartao[]
  onAbrir: (fatura: Fatura, cartao: Cartao) => void
}

export function FaturasOverview({ grupos, onAbrir }: Props) {
  const comFaturas = grupos.filter((g) => g.faturas.length > 0)

  if (comFaturas.length === 0) {
    return (
      <EmptyState
        title="Nenhuma fatura ainda"
        description="Registre uma despesa no crédito para gerar a primeira fatura."
      />
    )
  }

  return (
    <div className={styles.overviewGrid}>
      {comFaturas.map((g) => (
        <Panel
          key={g.cartao.id}
          title={g.cartao.nome}
          meta={`${g.faturas.length} ${pluralizar('fatura', g.faturas.length)}`}
          flush
        >
          <ul className={styles.overviewList}>
            {g.faturas.map((f) => (
              <li key={f.id} className={styles.itemBotao}>
                <button
                  type="button"
                  className={styles.overviewItem}
                  onClick={() => onAbrir(f, g.cartao)}
                >
                  <span className={styles.cardChip} style={{ background: g.cartao.cor }} />
                  <div className={styles.faturaInfo}>
                    <span className={styles.faturaMes}>
                      {formatarMesReferencia(f.mesReferencia, { capitalizar: true })}
                    </span>
                    <span className={styles.faturaSub}>
                      Fecha {formatarDataIso(f.dataFechamento)} · Vence{' '}
                      {formatarDataIso(f.dataVencimento)}
                    </span>
                  </div>
                  <Badge variant={statusVariant(f.status.kind)} />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  )
}
