import type { Categoria } from '@domain/entities/categoria'
import { Badge, EmptyState, RowActions } from '../../components/ui'
import styles from './categorias.module.css'

type Props = {
  categorias: Categoria[]
  onEditar: (categoria: Categoria) => void
  onArquivar: (categoria: Categoria) => void
  onDesarquivar: (id: number) => void
}

/**
 * Mesmo padrão da lista de cartões (ponto 16): largura cheia, editar visível,
 * arquivar no menu ⋯ com confirmação, e arquivadas esmaecidas no fim em vez de
 * escondidas atrás de um estado que recarrega a lista.
 *
 * Categoria não tem série histórica como o cartão, e desde a migration 0014
 * não tem mais tipo: a linha carrega nome, cor e o estado de arquivada.
 */
export function CategoriaList({ categorias, onEditar, onArquivar, onDesarquivar }: Props) {
  if (categorias.length === 0) {
    return (
      <EmptyState
        title="Nenhuma categoria encontrada."
        description="Crie uma categoria para poder classificar despesas e rendas."
      />
    )
  }

  const ativas = categorias.filter((c) => c.ativo)
  const arquivadas = categorias.filter((c) => !c.ativo)

  return (
    <ul className={styles.list}>
      {[...ativas, ...arquivadas].map((categoria) => (
        <li
          key={categoria.id}
          className={`${styles.listItem} ${categoria.ativo ? '' : styles.listItemArquivado}`}
        >
          <span className={styles.colorChip} style={{ background: categoria.cor }} />

          <div className={styles.listItemInfo}>
            <span className={styles.listItemNome}>{categoria.nome}</span>
          </div>

          <div className={styles.listItemActions}>
            {!categoria.ativo && <Badge variant="archived" />}
            <RowActions
              acoes={
                categoria.ativo
                  ? [
                      { label: 'Editar', onClick: () => onEditar(categoria) },
                      {
                        label: 'Arquivar',
                        onClick: () => onArquivar(categoria),
                        destrutiva: true
                      }
                    ]
                  : [{ label: 'Desarquivar', onClick: () => onDesarquivar(categoria.id) }]
              }
              contexto={categoria.nome}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
