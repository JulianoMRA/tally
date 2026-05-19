import type { Contribuidor } from '@domain/entities/contribuidor'
import { Badge, Button, EmptyState } from '../../components/ui'
import styles from './contribuidores.module.css'

type Props = {
  contribuidores: Contribuidor[]
  onEditar: (contribuidor: Contribuidor) => void
  onArquivar: (id: number) => void
  onDesarquivar: (id: number) => void
}

export function ContribuidorList({ contribuidores, onEditar, onArquivar, onDesarquivar }: Props) {
  if (contribuidores.length === 0) {
    return (
      <EmptyState
        title="Nenhum contribuidor cadastrado."
        description="Crie o primeiro contribuidor ao lado."
      />
    )
  }

  return (
    <ul className={styles.list}>
      {contribuidores.map((c) => (
        <li key={c.id} className={styles.listItem}>
          <div className={styles.avatar}>{c.nome.slice(0, 1).toUpperCase()}</div>
          <div className={styles.listItemInfo}>
            <span className={styles.listItemNome}>{c.nome}</span>
            <span className={styles.listItemMeta}>{c.contato ?? '—'}</span>
          </div>
          <div className={styles.listItemActions}>
            <Badge variant={c.ativo ? 'active' : 'archived'} />
            <Button size="sm" variant="ghost" onClick={() => onEditar(c)}>
              Editar
            </Button>
            {c.ativo ? (
              <Button size="sm" variant="danger" onClick={() => onArquivar(c.id)}>
                Arquivar
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => onDesarquivar(c.id)}>
                Desarquivar
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
