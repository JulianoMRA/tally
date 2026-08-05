import { useMemo, useState } from 'react'
import type { Cartao } from '@domain/entities/cartao'
import type { Fatura } from '@domain/entities/fatura'
import type { FaturaComTotal } from '@shared/ipc/fatura'
import type { GrupoFaturasCartao } from './hooks/use-faturas'
import { Badge, Button, EmptyState, Panel, SegmentedControl } from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import { formatarDataIso, formatarMesReferencia } from '../../lib/formatar-data'
import { mesAtualReferencia } from '../../lib/mes-atual'
import { pluralizar } from '../../lib/pluralizar'
import {
  filtrarPorStatus,
  particionarPorMes,
  somarTotais,
  type FiltroStatus
} from './organizar-faturas'
import { statusVariant } from './status-variant'
import styles from './faturas.module.css'

type Props = {
  grupos: GrupoFaturasCartao[]
  onAbrir: (fatura: Fatura, cartao: Cartao) => void
}

const FILTROS: readonly { valor: FiltroStatus; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'Aberta', rotulo: 'Abertas' },
  { valor: 'Fechada', rotulo: 'Fechadas' },
  { valor: 'Paga', rotulo: 'Pagas' }
]

function ItemFatura({
  item,
  cor,
  onAbrir
}: {
  item: FaturaComTotal
  cor: string
  onAbrir: () => void
}) {
  return (
    <li className={styles.itemBotao}>
      <button type="button" className={styles.overviewItem} onClick={onAbrir}>
        <span className={styles.cardChip} style={{ background: cor }} />
        <div className={styles.faturaInfo}>
          <span className={styles.faturaMes}>
            {formatarMesReferencia(item.mesReferencia, { capitalizar: true })}
          </span>
          <span className={styles.faturaSub}>
            Fecha {formatarDataIso(item.fatura.dataFechamento)} · Vence{' '}
            {formatarDataIso(item.fatura.dataVencimento)}
          </span>
        </div>
        <span className={`${styles.faturaTotal} tnum`}>{formatBRL(item.totalCentavos)}</span>
        <Badge variant={statusVariant(item.fatura.status.kind)} />
      </button>
    </li>
  )
}

function GrupoCartao({
  grupo,
  filtro,
  mesAtual,
  onAbrir
}: {
  grupo: GrupoFaturasCartao
  filtro: FiltroStatus
  mesAtual: string
  onAbrir: (fatura: Fatura, cartao: Cartao) => void
}) {
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false)

  const { anteriores, correntes } = useMemo(() => {
    return particionarPorMes(filtrarPorStatus(grupo.faturas, filtro), mesAtual)
  }, [grupo.faturas, filtro, mesAtual])

  const total = somarTotais(correntes)
  const nenhuma = anteriores.length === 0 && correntes.length === 0

  return (
    <Panel
      title={grupo.cartao.nome}
      meta={
        nenhuma
          ? 'nenhuma fatura neste filtro'
          : `${correntes.length} ${pluralizar('fatura', correntes.length)} · ${formatBRL(total)}`
      }
      flush
    >
      {nenhuma ? (
        <EmptyState title="Nenhuma fatura neste filtro." />
      ) : (
        <>
          {/* Só o que vem do mês atual em diante fica aberto: a lista despejava
              13+ faturas por cartão a partir da mais antiga, e o mês atual — o
              único que importa ao abrir a tela — ficava perdido no meio. */}
          <ul className={styles.overviewList}>
            {correntes.map((item) => (
              <ItemFatura
                key={item.fatura.id}
                item={item}
                cor={grupo.cartao.cor}
                onAbrir={() => onAbrir(item.fatura, grupo.cartao)}
              />
            ))}
          </ul>

          {anteriores.length > 0 && (
            <div className={styles.anterioresBarra}>
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={mostrarAnteriores}
                onClick={() => setMostrarAnteriores((v) => !v)}
              >
                {mostrarAnteriores ? 'Ocultar' : 'Mostrar'} {anteriores.length}{' '}
                {pluralizar('fatura', anteriores.length)} de meses anteriores
              </Button>
            </div>
          )}

          {mostrarAnteriores && (
            <ul className={styles.overviewList}>
              {anteriores.map((item) => (
                <ItemFatura
                  key={item.fatura.id}
                  item={item}
                  cor={grupo.cartao.cor}
                  onAbrir={() => onAbrir(item.fatura, grupo.cartao)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  )
}

export function FaturasOverview({ grupos, onAbrir }: Props) {
  const [filtro, setFiltro] = useState<FiltroStatus>('todas')
  const mesAtual = mesAtualReferencia()
  const comFaturas = grupos.filter((g) => g.faturas.length > 0)

  if (comFaturas.length === 0) {
    return (
      <EmptyState
        title="Nenhuma fatura ainda"
        description="Registre uma despesa no crédito para gerar a primeira fatura."
      />
    )
  }

  return (
    <>
      <div className={styles.overviewFiltro}>
        <SegmentedControl
          opcoes={FILTROS}
          valor={filtro}
          onChange={setFiltro}
          label="Filtrar faturas por status"
        />
      </div>

      <div className={styles.overviewGrid}>
        {comFaturas.map((g) => (
          <GrupoCartao
            key={g.cartao.id}
            grupo={g}
            filtro={filtro}
            mesAtual={mesAtual}
            onAbrir={onAbrir}
          />
        ))}
      </div>
    </>
  )
}
