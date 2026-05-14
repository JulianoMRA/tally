import type { Categoria } from '@domain/entities/categoria'
import styles from './categorias.module.css'

type Props = {
  categorias: Categoria[]
  onEditar: (categoria: Categoria) => void
  onArquivar: (id: number) => void
  onDesarquivar: (id: number) => void
}

export function CategoriaList({ categorias, onEditar, onArquivar, onDesarquivar }: Props) {
  if (categorias.length === 0) {
    return <p className={styles.empty}>Nenhuma categoria encontrada.</p>
  }

  return (
    <ul className={styles.list}>
      {categorias.map((categoria) => (
        <li key={categoria.id} className={styles.listItem}>
          <span className={styles.colorChip} style={{ background: categoria.cor }} />
          <div className={styles.listItemInfo}>
            <span className={styles.listItemNome}>
              {categoria.icone && <span className={styles.icone}>{categoria.icone}</span>}
              {categoria.nome}
              {!categoria.ativo && <span className={styles.badgeArquivado}>Arquivado</span>}
            </span>
            <span className={styles.listItemMeta}>
              <span className={styles.badgeTipo}>{categoria.tipo}</span>
            </span>
          </div>
          <div className={styles.listItemActions}>
            <button type="button" onClick={() => onEditar(categoria)} className={styles.btnSmall}>
              Editar
            </button>
            {categoria.ativo ? (
              <button
                type="button"
                onClick={() => onArquivar(categoria.id)}
                className={`${styles.btnSmall} ${styles.btnDanger}`}
              >
                Arquivar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onDesarquivar(categoria.id)}
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
