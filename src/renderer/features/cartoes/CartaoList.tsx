import type { Cartao } from '@domain/entities/cartao'
import { Badge, Button, EmptyState } from '../../components/ui'
import styles from './cartoes.module.css'

type Props = {
  cartoes: Cartao[]
  onEditar: (cartao: Cartao) => void
  onArquivar: (id: number) => void
  onDesarquivar: (id: number) => void
}

export function CartaoList({ cartoes, onEditar, onArquivar, onDesarquivar }: Props) {
  if (cartoes.length === 0) {
    return (
      <EmptyState
        title="Nenhum cartão encontrado."
        description="Crie seu primeiro cartão ao lado."
      />
    )
  }

  return (
    <ul className={styles.list}>
      {cartoes.map((cartao) => (
        <li key={cartao.id} className={styles.listItem}>
          <span className={styles.colorChip} style={{ background: cartao.cor }} />
          <div className={styles.listItemInfo}>
            <span className={styles.listItemNome}>{cartao.nome}</span>
            <span className={styles.listItemMeta}>
              Fecha dia {cartao.diaFechamento} · Vence dia {cartao.diaVencimento}
            </span>
          </div>
          <div className={styles.listItemActions}>
            <Badge variant={cartao.ativo ? 'active' : 'archived'} />
            <Button size="sm" variant="ghost" onClick={() => onEditar(cartao)}>
              Editar
            </Button>
            {cartao.ativo ? (
              <Button size="sm" variant="secondary" onClick={() => onArquivar(cartao.id)}>
                Arquivar
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => onDesarquivar(cartao.id)}>
                Desarquivar
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
