import type { BalancoMensal } from '@shared/ipc/visao-mensal'
import { formatBRL } from '../../lib/format-brl'
import styles from './visao-mensal.module.css'

type Props = {
  totais: BalancoMensal
}

/**
 * Card de saldo do mês. O número grande é o saldo PROJETADO; a linha de apoio
 * mostra o saldo contando só o que já entrou. Os dois rótulos são explícitos
 * porque o RN-08 mistura regimes: entradas entram por caixa, saídas entram
 * integralmente mesmo em fatura ainda não paga.
 */
export function SaldoCard({ totais }: Props) {
  const classeSinal = (centavos: number) => (centavos >= 0 ? styles.positivo : styles.negativo)

  return (
    <div className={styles.saldoCard}>
      <div>
        <div className={styles.saldoLabel}>Saldo do mês</div>
        <div className={styles.saldoSub}>
          Só entradas recebidas{' '}
          <span className={classeSinal(totais.saldoRealizadoCentavos)}>
            {formatBRL(totais.saldoRealizadoCentavos)}
          </span>
        </div>
      </div>
      <div className={styles.saldoBigWrap}>
        <div className={`${styles.saldoBig} ${classeSinal(totais.saldoProjetadoCentavos)}`}>
          {formatBRL(totais.saldoProjetadoCentavos)}
        </div>
        <div className={styles.saldoHint}>
          Projetado: inclui entradas ainda esperadas. Saídas contam integralmente, mesmo em fatura
          não paga.
        </div>
      </div>
    </div>
  )
}
