import { useState } from 'react'
import type { Fatura } from '@domain/entities/fatura'
import { useCartoesAtivos } from '../despesas/hooks/use-cartoes-ativos'
import { useFaturasPorCartao, useFaturaDetalhe } from './hooks/use-faturas'
import { FaturaDetalhe } from './FaturaDetalhe'
import styles from './faturas.module.css'

type Modo = { kind: 'lista' } | { kind: 'detalhe'; faturaId: number }

function statusClass(kind: string, styles: Record<string, string>): string {
  if (kind === 'Aberta') return styles.statusAberta
  if (kind === 'Fechada') return styles.statusFechada
  return styles.statusPaga
}

export default function FaturasPage() {
  const [cartaoId, setCartaoId] = useState<number | null>(null)
  const [modo, setModo] = useState<Modo>({ kind: 'lista' })

  const { cartoes } = useCartoesAtivos()
  const { faturas, loading: loadingFaturas } = useFaturasPorCartao(cartaoId)
  const { detalhe, loading: loadingDetalhe } = useFaturaDetalhe(
    modo.kind === 'detalhe' ? modo.faturaId : null
  )

  const cartaoSelecionado = cartoes.find((c) => c.id === cartaoId)

  function handleAbrirDetalhe(fatura: Fatura) {
    setModo({ kind: 'detalhe', faturaId: fatura.id })
  }

  function handleVoltar() {
    setModo({ kind: 'lista' })
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>Faturas</h1>
        <p>Visualize as faturas por cartão e confira as parcelas de cada uma.</p>
      </div>

      <div className={styles.cartaoSelect}>
        <label htmlFor="cartaoSelect">Cartão:</label>
        <select
          id="cartaoSelect"
          value={cartaoId ?? ''}
          onChange={(e) => {
            setCartaoId(e.target.value ? Number(e.target.value) : null)
            setModo({ kind: 'lista' })
          }}
        >
          <option value="">Selecione um cartão…</option>
          {cartoes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      {modo.kind === 'lista' && (
        <>
          {cartaoId === null && (
            <p className={styles.empty}>Selecione um cartão para ver as faturas.</p>
          )}
          {cartaoId !== null && loadingFaturas && <p className={styles.empty}>Carregando…</p>}
          {cartaoId !== null && !loadingFaturas && faturas.length === 0 && (
            <p className={styles.empty}>Nenhuma fatura encontrada para este cartão.</p>
          )}
          {faturas.length > 0 && (
            <ul className={styles.faturaList}>
              {faturas.map((f) => (
                <li
                  key={f.id}
                  className={styles.faturaItem}
                  onClick={() => handleAbrirDetalhe(f)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleAbrirDetalhe(f)}
                >
                  <span className={styles.faturaMes}>{f.mesReferencia}</span>
                  <span className={`${styles.faturaStatus} ${statusClass(f.status.kind, styles)}`}>
                    {f.status.kind}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {modo.kind === 'detalhe' && (
        <>
          {loadingDetalhe && <p className={styles.empty}>Carregando…</p>}
          {!loadingDetalhe && detalhe && (
            <FaturaDetalhe
              detalhe={detalhe}
              cartaoNome={cartaoSelecionado?.nome ?? ''}
              onVoltar={handleVoltar}
            />
          )}
        </>
      )}
    </div>
  )
}
