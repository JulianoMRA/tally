import type { FaturaDetalhada } from '@shared/ipc/fatura'
import styles from './faturas.module.css'

type Props = {
  detalhe: FaturaDetalhada
  cartaoNome: string
  onVoltar: () => void
}

function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function statusLabel(kind: string): string {
  if (kind === 'Aberta') return 'Aberta'
  if (kind === 'Fechada') return 'Fechada'
  return 'Paga'
}

function statusClass(kind: string, styles: Record<string, string>): string {
  if (kind === 'Aberta') return styles.statusAberta
  if (kind === 'Fechada') return styles.statusFechada
  return styles.statusPaga
}

export function FaturaDetalhe({ detalhe, cartaoNome, onVoltar }: Props) {
  const { fatura, parcelas, totalBrutoCentavos } = detalhe
  const kind = fatura.status.kind

  return (
    <div className={styles.detalhe}>
      <div className={styles.detalheHeader}>
        <div>
          <h2>
            {cartaoNome} — {fatura.mesReferencia}
          </h2>
          <p>
            Fechamento: {fatura.dataFechamento} · Vencimento: {fatura.dataVencimento}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={`${styles.faturaStatus} ${statusClass(kind, styles)}`}>
            {statusLabel(kind)}
          </span>
          <button className={styles.btnVoltar} onClick={onVoltar}>
            ← Voltar
          </button>
        </div>
      </div>

      {parcelas.length === 0 ? (
        <p className={styles.empty}>Nenhuma parcela nesta fatura.</p>
      ) : (
        <>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>#</th>
                <th>Descrição</th>
                <th>Parcela</th>
                <th>Data</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {parcelas.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>—</td>
                  <td>
                    {p.numero}/{p.total ?? '?'}
                  </td>
                  <td>{p.dataReferencia}</td>
                  <td>{formatBRL(p.valorCentavos)}</td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.totalRow}>Total bruto: {formatBRL(totalBrutoCentavos)}</p>
        </>
      )}
    </div>
  )
}
