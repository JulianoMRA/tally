import type { FaturaDetalhada } from '@shared/ipc/fatura'
import { Badge, Button, Panel, EmptyState } from '../../components/ui'
import styles from './faturas.module.css'

type Props = {
  detalhe: FaturaDetalhada
  cartaoNome: string
  cartaoCor?: string
  onVoltar: () => void
}

function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function statusVariant(kind: string): 'open' | 'closed' | 'paid' {
  if (kind === 'Aberta') return 'open'
  if (kind === 'Fechada') return 'closed'
  return 'paid'
}

export function FaturaDetalhe({ detalhe, cartaoNome, cartaoCor, onVoltar }: Props) {
  const { fatura, parcelas, totalBrutoCentavos } = detalhe
  const kind = fatura.status.kind

  return (
    <div className={styles.detalhe}>
      <div className={styles.detalheHeader}>
        <div className={styles.detalheTitle}>
          {cartaoCor && <span className={styles.cardChip} style={{ background: cartaoCor }} />}
          <div>
            <h2 className={styles.detalheTitleText}>
              {cartaoNome} · {fatura.mesReferencia}
            </h2>
            <p className={styles.detalheMeta}>
              Fecha {fatura.dataFechamento} · Vence {fatura.dataVencimento}
            </p>
          </div>
        </div>
        <div className={styles.detalheActions}>
          <Badge variant={statusVariant(kind)} />
          <Button variant="ghost" size="sm" onClick={onVoltar}>
            ← Voltar
          </Button>
        </div>
      </div>

      <Panel
        title="Parcelas"
        meta={`${parcelas.length} lançamento${parcelas.length !== 1 ? 's' : ''}`}
        flush
      >
        {parcelas.length === 0 ? (
          <EmptyState title="Nenhuma parcela nesta fatura." />
        ) : (
          <>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Parcela</th>
                  <th>Data</th>
                  <th className={styles.colValor}>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {parcelas.map((p) => (
                  <tr key={p.id}>
                    <td className={styles.colId}>{p.id}</td>
                    <td className="mono">
                      {p.numero}/{p.total ?? '?'}
                    </td>
                    <td>{p.dataReferencia}</td>
                    <td className={`${styles.colValor} tnum`}>{formatBRL(p.valorCentavos)}</td>
                    <td>
                      <Badge variant={p.status === 'Paga' ? 'paid' : 'pending'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total bruto</span>
              <span className={`${styles.totalValor} tnum`}>{formatBRL(totalBrutoCentavos)}</span>
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}
