import styles from './badge.module.css'

type BadgeVariant =
  | 'open'
  | 'closed'
  | 'paid'
  | 'pending'
  | 'income'
  | 'expense'
  | 'active'
  | 'archived'
  | 'projection'

interface BadgeProps {
  variant: BadgeVariant
  label?: string
}

const LABELS: Record<BadgeVariant, string> = {
  open: 'Aberta',
  closed: 'Fechada',
  paid: 'Paga',
  pending: 'Pendente',
  income: 'Receita',
  expense: 'Despesa',
  active: 'Ativo',
  archived: 'Arquivado',
  projection: 'Projeção'
}

export function Badge({ variant, label }: BadgeProps) {
  return (
    <span className={[styles.badge, styles[variant]].join(' ')}>
      <span className={styles.dot} />
      {label ?? LABELS[variant]}
    </span>
  )
}
