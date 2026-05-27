import { useEffect, useState } from 'react'
import type { Categoria } from '@domain/entities/categoria'
import { PageHead } from '../../components/layout/PageHead'
import { EmptyState, Field, Input, Panel } from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import { mesAtualReferencia } from '../../lib/mes-atual'
import { useGastosForaCartao } from './hooks/use-gastos'
import styles from './gastos.module.css'

function chipClass(forma: string): string {
  if (forma === 'Pix') return styles.chipPix
  if (forma === 'Debito') return styles.chipDebito
  return styles.chipDinheiro
}

function rotuloForma(forma: string): string {
  if (forma === 'Debito') return 'Débito'
  return forma
}

export default function GastosPage() {
  const [mes, setMes] = useState(mesAtualReferencia())
  const { gastos, loading, erro } = useGastosForaCartao(mes)
  const [categorias, setCategorias] = useState<Categoria[]>([])

  useEffect(() => {
    window.api.categoria.list().then(setCategorias)
  }, [])

  function nomeCategoria(id: number): string {
    return categorias.find((c) => c.id === id)?.nome ?? `#${id}`
  }

  const total = gastos.reduce((s, g) => s + g.valorCentavos, 0)

  return (
    <div>
      <PageHead
        title="Gastos fora de cartão"
        subtitle="Pix, débito e dinheiro agrupados pelo mês calendário."
      />

      <div className={styles.body}>
        <div className={styles.toolbar}>
          <Field label="Mês">
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </Field>
        </div>

        {erro && <p className={styles.erro}>{erro}</p>}

        <Panel title={`Lançamentos · ${mes}`} flush>
          {loading ? (
            <EmptyState title="Carregando…" />
          ) : gastos.length === 0 ? (
            <EmptyState title="Nenhum gasto fora de cartão neste mês." />
          ) : (
            <ul className={styles.lista}>
              {gastos.map((g) => (
                <li key={g.id} className={styles.item}>
                  <span className={`${styles.chip} ${chipClass(g.formaPagamento)}`} />
                  <div className={styles.info}>
                    <span className={styles.descricao}>{g.descricao}</span>
                    <span className={styles.meta}>{nomeCategoria(g.categoriaId)}</span>
                  </div>
                  <span className={styles.forma}>{rotuloForma(g.formaPagamento)}</span>
                  <span className={styles.valor}>{formatBRL(g.valorCentavos)}</span>
                  <span className={styles.data}>{g.dataCompra}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {gastos.length > 0 && (
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Total do mês</span>
            <span className={styles.totalValor}>{formatBRL(total)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
