import type { Categoria } from '@domain/entities/categoria'
import { Badge, Button, EmptyState } from '../../components/ui'
import styles from './categorias.module.css'

type Props = {
  categorias: Categoria[]
  onEditar: (categoria: Categoria) => void
  onArquivar: (id: number) => void
  onDesarquivar: (id: number) => void
}

const TIPO_LABEL: Record<string, string> = { Despesa: 'Despesa', Renda: 'Renda', Ambos: 'Ambos' }

export function CategoriaList({ categorias, onEditar, onArquivar, onDesarquivar }: Props) {
  if (categorias.length === 0) {
    return (
      <EmptyState
        title="Nenhuma categoria encontrada."
        description="Crie sua primeira categoria ao lado."
      />
    )
  }

  return (
    <ul className={styles.list}>
      {categorias.map((categoria) => (
        <li key={categoria.id} className={styles.listItem}>
          <span className={styles.colorChip} style={{ background: categoria.cor }} />
          <div className={styles.listItemInfo}>
            <span className={styles.listItemNome}>{categoria.nome}</span>
            <span className={styles.listItemMeta}>{TIPO_LABEL[categoria.tipo]}</span>
          </div>
          <div className={styles.listItemActions}>
            <Badge variant={categoria.ativo ? 'active' : 'archived'} />
            <Button size="sm" variant="ghost" onClick={() => onEditar(categoria)}>
              Editar
            </Button>
            {categoria.ativo ? (
              <Button size="sm" variant="danger" onClick={() => onArquivar(categoria.id)}>
                Arquivar
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => onDesarquivar(categoria.id)}>
                Desarquivar
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
