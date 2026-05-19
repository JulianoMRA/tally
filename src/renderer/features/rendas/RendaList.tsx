import type { Renda } from '@domain/entities/renda'
import { Badge, Button, EmptyState } from '../../components/ui'
import styles from './rendas.module.css'

function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type Props = {
  rendas: Renda[]
  onArquivar: (id: number) => void
  onDesarquivar: (id: number) => void
}

export function RendaList({ rendas, onArquivar, onDesarquivar }: Props) {
  if (rendas.length === 0) {
    return (
      <EmptyState
        title="Nenhuma fonte de renda cadastrada."
        description="Crie sua primeira fonte ao lado."
      />
    )
  }

  return (
    <ul className={styles.list}>
      {rendas.map((r) => (
        <li key={r.id} className={styles.listItem}>
          <div className={styles.avatar}>{r.nome.slice(0, 1).toUpperCase()}</div>
          <div className={styles.listItemInfo}>
            <span className={styles.listItemNome}>{r.nome}</span>
            <span className={styles.listItemMeta}>
              {r.tipo}
              {r.diaEsperado !== null ? ` · dia ${r.diaEsperado}` : ''}
            </span>
          </div>
          <span className={styles.listItemValor}>{formatBRL(r.valorPadraoCentavos)}</span>
          <Badge variant={r.ativa ? 'active' : 'archived'} />
          <div className={styles.listItemActions}>
            {r.ativa ? (
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (
                    window.confirm(
                      `Arquivar "${r.nome}"? Recebimentos esperados futuros serão apagados; histórico recebido permanece.`
                    )
                  )
                    onArquivar(r.id)
                }}
              >
                Arquivar
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => onDesarquivar(r.id)}>
                Desarquivar
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
