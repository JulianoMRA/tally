import { useMemo, useState } from 'react'
import type { FaturaComTotal } from '@shared/ipc/fatura'
import { Badge, Button, EmptyState, Panel, SegmentedControl } from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import { formatarDataIso, formatarMesReferencia } from '../../lib/formatar-data'
import { pluralizar } from '../../lib/pluralizar'
import { filtrarPorStatus, somarTotais, type FiltroStatus } from './organizar-faturas'
import { statusVariant } from './status-variant'
import styles from './faturas.module.css'

const FILTROS: readonly { valor: FiltroStatus; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'Aberta', rotulo: 'Abertas' },
  { valor: 'Fechada', rotulo: 'Fechadas' },
  { valor: 'Paga', rotulo: 'Pagas' }
]

type Props = {
  faturas: FaturaComTotal[]
  mesAtual: string
  faturaAbertaId: number | null
  cartaoCor: string
  onAbrir: (faturaId: number) => void
}

/**
 * O histórico do cartão, colapsado num bloco só (ponto 13).
 *
 * **Só o passado entra aqui.** As faturas futuras saíram da lista e viraram
 * navegação de mês no painel: um parcelamento de 12x cria doze faturas futuras
 * idênticas, e listá-las produzia uma parede de linhas de mesmo valor com o
 * mesmo peso visual do mês corrente — que é exatamente o defeito que o ponto 13
 * descreve. O total agregado fica à vista mesmo colapsado, porque é ele que
 * justifica expandir.
 *
 * O filtro por status veio da `FaturasOverview`, que a fusão absorveu. Lá ele
 * varria as faturas de TODOS os cartões; aqui o escopo é o cartão em foco, que
 * é o recorte que a tela nova tem. A pergunta que ele responde continua sendo
 * a mesma: o que ficou para trás sem pagar.
 */
export function HistoricoFaturas({ faturas, mesAtual, faturaAbertaId, cartaoCor, onAbrir }: Props) {
  const [mostrarPassadas, setMostrarPassadas] = useState(false)
  const [filtro, setFiltro] = useState<FiltroStatus>('todas')

  const todasPassadas = useMemo(
    () =>
      faturas
        .filter((f) => f.fatura.id !== faturaAbertaId && f.mesReferencia < mesAtual)
        .sort((a, b) => b.mesReferencia.localeCompare(a.mesReferencia)),
    [faturas, mesAtual, faturaAbertaId]
  )

  const passadas = useMemo(() => filtrarPorStatus(todasPassadas, filtro), [todasPassadas, filtro])

  if (todasPassadas.length === 0) return null

  return (
    <Panel
      title="Histórico deste cartão"
      meta={`${passadas.length}`}
      actions={
        <SegmentedControl
          opcoes={FILTROS}
          valor={filtro}
          onChange={setFiltro}
          label="Filtrar faturas por status"
        />
      }
      flush
    >
      {passadas.length > 0 && (
        <div className={styles.anterioresBarra}>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={mostrarPassadas}
            onClick={() => setMostrarPassadas((v) => !v)}
          >
            {mostrarPassadas ? 'Ocultar' : 'Mostrar'} {passadas.length}{' '}
            {pluralizar('fatura', passadas.length)} de meses anteriores
          </Button>
          <span className={`${styles.anterioresTotal} tnum`}>
            {formatBRL(somarTotais(passadas))}
          </span>
        </div>
      )}

      {mostrarPassadas && passadas.length > 0 && (
        <ul className={styles.faturaList}>
          {passadas.map((f) => (
            <LinhaFatura key={f.fatura.id} item={f} cor={cartaoCor} onAbrir={onAbrir} />
          ))}
        </ul>
      )}

      {passadas.length === 0 && <EmptyState title="Nenhuma fatura neste filtro." />}
    </Panel>
  )
}

function LinhaFatura({
  item,
  cor,
  onAbrir
}: {
  item: FaturaComTotal
  cor: string
  onAbrir: (faturaId: number) => void
}) {
  return (
    <li className={styles.itemBotao}>
      <button type="button" className={styles.faturaItem} onClick={() => onAbrir(item.fatura.id)}>
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
