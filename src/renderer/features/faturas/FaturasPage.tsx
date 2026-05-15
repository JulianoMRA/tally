import { useState } from 'react'
import type { Fatura } from '@domain/entities/fatura'
import { useCartoesAtivos } from '../despesas/hooks/use-cartoes-ativos'
import { useFaturasPorCartao, useFaturaDetalhe } from './hooks/use-faturas'
import { FaturaDetalhe } from './FaturaDetalhe'
import { PageHead } from '../../components/layout/PageHead'
import { Badge, EmptyState, Select } from '../../components/ui'
import styles from './faturas.module.css'

type Modo = { kind: 'lista' } | { kind: 'detalhe'; faturaId: number }

function statusVariant(kind: string): 'open' | 'closed' | 'paid' {
  if (kind === 'Aberta') return 'open'
  if (kind === 'Fechada') return 'closed'
  return 'paid'
}

export default function FaturasPage() {
  const [cartaoId, setCartaoId] = useState<number | null>(null)
  const [modo, setModo] = useState<Modo>({ kind: 'lista' })

  const { cartoes } = useCartoesAtivos()
  const {
    faturas,
    loading: loadingFaturas,
    refetch: refetchFaturas
  } = useFaturasPorCartao(cartaoId)
  const {
    detalhe,
    loading: loadingDetalhe,
    refetch: refetchDetalhe
  } = useFaturaDetalhe(modo.kind === 'detalhe' ? modo.faturaId : null)

  const cartaoSelecionado = cartoes.find((c) => c.id === cartaoId)

  function handleAbrirDetalhe(fatura: Fatura) {
    setModo({ kind: 'detalhe', faturaId: fatura.id })
  }

  function handleVoltar() {
    setModo({ kind: 'lista' })
  }

  return (
    <div>
      <PageHead
        title="Faturas"
        subtitle="Visualize as faturas por cartão e confira as parcelas de cada uma."
      />

      <div className={styles.body}>
        <div className={styles.cartaoSelect}>
          <label htmlFor="cartaoSelect" className={styles.cartaoLabel}>
            Cartão
          </label>
          <Select
            id="cartaoSelect"
            value={cartaoId ?? ''}
            onChange={(e) => {
              setCartaoId(e.target.value ? Number(e.target.value) : null)
              setModo({ kind: 'lista' })
            }}
            style={{ maxWidth: 240 }}
          >
            <option value="">Selecione um cartão…</option>
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>

        {modo.kind === 'lista' && (
          <>
            {cartaoId === null && (
              <EmptyState
                title="Selecione um cartão"
                description="Escolha um cartão acima para ver as faturas."
              />
            )}
            {cartaoId !== null && loadingFaturas && <p className={styles.empty}>Carregando…</p>}
            {cartaoId !== null && !loadingFaturas && faturas.length === 0 && (
              <EmptyState
                title="Nenhuma fatura encontrada"
                description="Registre uma despesa no crédito para gerar a primeira fatura."
              />
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
                    <span
                      className={styles.cardChip}
                      style={{ background: cartaoSelecionado?.cor ?? 'var(--ink-3)' }}
                    />
                    <div className={styles.faturaInfo}>
                      <span className={styles.faturaMes}>{f.mesReferencia}</span>
                      <span className={styles.faturaSub}>
                        Fecha {f.dataFechamento} · Vence {f.dataVencimento}
                      </span>
                    </div>
                    <Badge variant={statusVariant(f.status.kind)} />
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
                cartaoCor={cartaoSelecionado?.cor}
                onVoltar={handleVoltar}
                onFaturaAtualizada={() => {
                  refetchFaturas()
                  refetchDetalhe()
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
