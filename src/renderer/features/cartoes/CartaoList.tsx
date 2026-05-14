import type { Cartao } from '@domain/entities/cartao'
import styles from './cartoes.module.css'

type Props = {
  cartoes: Cartao[]
  onEditar: (cartao: Cartao) => void
  onArquivar: (id: number) => void
  onDesarquivar: (id: number) => void
}

export function CartaoList({ cartoes, onEditar, onArquivar, onDesarquivar }: Props) {
  if (cartoes.length === 0) {
    return <p className={styles.empty}>Nenhum cartão encontrado.</p>
  }

  return (
    <ul className={styles.list}>
      {cartoes.map((cartao) => (
        <li key={cartao.id} className={styles.listItem}>
          <span className={styles.colorChip} style={{ background: cartao.cor }} />
          <div className={styles.listItemInfo}>
            <span className={styles.listItemNome}>
              {cartao.nome}
              {!cartao.ativo && <span className={styles.badgeArquivado}>Arquivado</span>}
            </span>
            <span className={styles.listItemMeta}>
              Fecha dia {cartao.diaFechamento} · Vence dia {cartao.diaVencimento}
            </span>
          </div>
          <div className={styles.listItemActions}>
            <button type="button" onClick={() => onEditar(cartao)} className={styles.btnSmall}>
              Editar
            </button>
            {cartao.ativo ? (
              <button
                type="button"
                onClick={() => onArquivar(cartao.id)}
                className={`${styles.btnSmall} ${styles.btnDanger}`}
              >
                Arquivar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onDesarquivar(cartao.id)}
                className={`${styles.btnSmall} ${styles.btnSuccess}`}
              >
                Desarquivar
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
