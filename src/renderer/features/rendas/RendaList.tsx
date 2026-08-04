import { useState } from 'react'
import type { Renda } from '@domain/entities/renda'
import { Badge, Button, ConfirmDialog, EmptyState } from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import styles from './rendas.module.css'

type Props = {
  rendas: Renda[]
  onEditar: (renda: Renda) => void
  onArquivar: (id: number) => void
  onDesarquivar: (id: number) => void
}

export function RendaList({ rendas, onEditar, onArquivar, onDesarquivar }: Props) {
  const [arquivar, setArquivar] = useState<Renda | null>(null)

  if (rendas.length === 0) {
    return (
      <EmptyState
        title="Nenhuma fonte de renda cadastrada."
        description="Crie sua primeira fonte ao lado."
      />
    )
  }

  return (
    <>
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
              {r.ativa && (
                <Button size="sm" variant="ghost" onClick={() => onEditar(r)}>
                  Editar
                </Button>
              )}
              {r.ativa ? (
                <Button size="sm" variant="secondary" onClick={() => setArquivar(r)}>
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

      {arquivar && (
        <ConfirmDialog
          title={`Arquivar "${arquivar.nome}"?`}
          body="Recebimentos esperados futuros serão apagados; histórico recebido permanece."
          confirmText="Arquivar"
          confirmVariant="danger"
          onConfirm={() => {
            onArquivar(arquivar.id)
            setArquivar(null)
          }}
          onCancel={() => setArquivar(null)}
        />
      )}
    </>
  )
}
