import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Cartao } from '@domain/entities/cartao'
import type { Fatura } from '@domain/entities/fatura'
import { useCartoesAtivos } from '../despesas/hooks/use-cartoes-ativos'
import {
  useFaturasPorCartao,
  useFaturaDetalhe,
  useFaturasDeTodosCartoes
} from './hooks/use-faturas'
import { FaturaDetalhe } from './FaturaDetalhe'
import { FaturasOverview } from './FaturasOverview'
import { PageContainer } from '../../components/layout/PageContainer'
import { PageHead } from '../../components/layout/PageHead'
import { Badge, Button, EmptyState, Select } from '../../components/ui'
import { formatarDataIso, formatarMesReferencia } from '../../lib/formatar-data'
import { buildFaturasSearch, parseFaturasSearch } from './faturas-search'
import { statusVariant } from './status-variant'
import styles from './faturas.module.css'

type Modo = { kind: 'lista' } | { kind: 'detalhe'; faturaId: number }

export default function FaturasPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  // Lê o deep-link uma única vez na montagem; a partir daí o estado é a fonte
  // de verdade e os handlers reescrevem a URL (replace) para manter o link
  // estável em refresh/voltar.
  const [cartaoId, setCartaoId] = useState<number | null>(
    () => parseFaturasSearch(searchParams).cartaoId
  )
  const [modo, setModo] = useState<Modo>(() => {
    const { faturaId } = parseFaturasSearch(searchParams)
    return faturaId !== null ? { kind: 'detalhe', faturaId } : { kind: 'lista' }
  })

  const { cartoes, loading: loadingCartoes } = useCartoesAtivos()
  const {
    grupos,
    loading: loadingOverview,
    refetch: refetchOverview
  } = useFaturasDeTodosCartoes(cartoes)
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

  function sincronizarUrl(proxCartaoId: number | null, proxFaturaId: number | null) {
    if (proxCartaoId !== null && proxFaturaId !== null) {
      setSearchParams(buildFaturasSearch(proxCartaoId, proxFaturaId), { replace: true })
    } else if (proxCartaoId !== null) {
      setSearchParams({ cartaoId: String(proxCartaoId) }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }

  function handleSelecionarCartao(val: string) {
    const prox = val ? Number(val) : null
    setCartaoId(prox)
    setModo({ kind: 'lista' })
    sincronizarUrl(prox, null)
  }

  function handleAbrirDetalhe(fatura: Fatura) {
    setModo({ kind: 'detalhe', faturaId: fatura.id })
    sincronizarUrl(cartaoId, fatura.id)
  }

  // A partir da visão geral é preciso fixar o cartão antes (nome/cor do detalhe
  // e o deep-link derivam dele).
  function handleAbrirDetalheOverview(fatura: Fatura, cartao: Cartao) {
    setCartaoId(cartao.id)
    setModo({ kind: 'detalhe', faturaId: fatura.id })
    sincronizarUrl(cartao.id, fatura.id)
  }

  function handleVoltar() {
    setModo({ kind: 'lista' })
    sincronizarUrl(cartaoId, null)
    refetchOverview()
  }

  return (
    <PageContainer>
      <PageHead
        title="Faturas"
        subtitle="Visualize as faturas por cartão e confira as parcelas de cada uma."
      />

      <div className={styles.corpo}>
        <div className={styles.cartaoSelect}>
          <label htmlFor="cartaoSelect" className={styles.cartaoLabel}>
            Cartão
          </label>
          <Select
            id="cartaoSelect"
            value={cartaoId ?? ''}
            disabled={loadingCartoes}
            onChange={(e) => handleSelecionarCartao(e.target.value)}
            style={{ maxWidth: 240 }}
          >
            {loadingCartoes ? (
              <option value="">Carregando cartões…</option>
            ) : cartoes.length === 0 ? (
              <option value="">Nenhum cartão cadastrado</option>
            ) : (
              <>
                <option value="">Selecione um cartão…</option>
                {cartoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </>
            )}
          </Select>
        </div>

        {modo.kind === 'lista' && (
          <>
            {cartaoId === null && loadingOverview && <p className={styles.empty}>Carregando…</p>}
            {cartaoId === null && !loadingOverview && (
              <FaturasOverview grupos={grupos} onAbrir={handleAbrirDetalheOverview} />
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
                      <span className={styles.faturaMes}>
                        {formatarMesReferencia(f.mesReferencia, { capitalizar: true })}
                      </span>
                      <span className={styles.faturaSub}>
                        Fecha {formatarDataIso(f.dataFechamento)} · Vence{' '}
                        {formatarDataIso(f.dataVencimento)}
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
                onDetalheAtualizado={() => {
                  refetchDetalhe()
                }}
              />
            )}
            {!loadingDetalhe && !detalhe && (
              <EmptyState
                title="Fatura não encontrada"
                description="A fatura informada não existe ou foi removida."
                action={<Button onClick={handleVoltar}>Voltar</Button>}
              />
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}
