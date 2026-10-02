import { useMemo, useState } from 'react'
import { quitadaPorParciais } from '@domain/services/pagamento-parcial'
import type { FaturaComTotal } from '@shared/ipc/fatura'
import { hojeIsoLocal } from '@shared/datas-locais'
import {
  Badge,
  BolinhaDeCor,
  Button,
  EmptyState,
  Panel,
  SegmentedControl
} from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import { formatarMesReferencia } from '../../lib/formatar-data'
import { pluralizar } from '../../lib/pluralizar'
import { rotuloVencida } from './aviso-fechamento'
import { datasDaLinha } from './datas-da-linha'
import { contextoDoParcial } from './descrever-parcial'
import {
  contarPorStatus,
  filtrarPorStatus,
  somarAPagar,
  type FiltroStatus
} from './organizar-faturas'
import { statusVariant } from './status-variant'
import styles from './faturas.module.css'

/**
 * "A pagar", e não "Não pagas": o `getByRole` do Playwright casa o nome por
 * substring, e "Não pagas" responderia também por "Pagas".
 */
const FILTROS: readonly { valor: FiltroStatus; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'a-pagar', rotulo: 'A pagar' },
  { valor: 'pagas', rotulo: 'Pagas' }
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
 * descreve.
 *
 * O filtro por status veio da `FaturasOverview`, que a fusão absorveu. Lá ele
 * varria as faturas de TODOS os cartões; aqui o escopo é o cartão em foco, que
 * é o recorte que a tela nova tem. A pergunta que ele responde continua sendo
 * a mesma: o que ficou para trás sem pagar.
 *
 * **A fatura que o painel exibe continua na lista**, marcada. Ela saía, e as
 * contagens mudavam com o que estava aberto: com a única fatura a pagar em
 * exibição, a aba passava de "A pagar 1" para "A pagar 0" — e ela continuava
 * sem pagar. Contagem e soma são fatos do cartão, não da navegação.
 */
export function HistoricoFaturas({ faturas, mesAtual, faturaAbertaId, cartaoCor, onAbrir }: Props) {
  const [mostrarPassadas, setMostrarPassadas] = useState(false)
  const [filtro, setFiltro] = useState<FiltroStatus>('todas')

  const todasPassadas = useMemo(
    () =>
      faturas
        .filter((f) => f.mesReferencia < mesAtual)
        .sort((a, b) => b.mesReferencia.localeCompare(a.mesReferencia)),
    [faturas, mesAtual]
  )

  const passadas = useMemo(() => filtrarPorStatus(todasPassadas, filtro), [todasPassadas, filtro])

  // A contagem entra no rótulo, como nas abas de Saídas: "A pagar 1" responde
  // o que ficou para trás sem pagar sem precisar abrir a lista.
  const opcoes = useMemo(() => {
    const contagem = contarPorStatus(todasPassadas)
    return FILTROS.map((f) => ({ valor: f.valor, rotulo: `${f.rotulo} ${contagem[f.valor]}` }))
  }, [todasPassadas])

  // Escolher uma aba é querer ver o que ela filtra: filtrar uma lista fechada
  // só mudava um número.
  function escolherFiltro(proximo: FiltroStatus) {
    setFiltro(proximo)
    setMostrarPassadas(true)
  }

  if (todasPassadas.length === 0) return null

  const hoje = hojeIsoLocal()
  const aPagar = somarAPagar(passadas)

  return (
    <Panel
      title="Histórico deste cartão"
      actions={
        <SegmentedControl
          opcoes={opcoes}
          valor={filtro}
          onChange={escolherFiltro}
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
          {/* Com nome, e só o que está por pagar: era um número solto que, em
              "Todas", somava o que falta com o que já tinha sido quitado. */}
          {aPagar > 0 && (
            <span className={`${styles.anterioresTotal} tnum`}>{formatBRL(aPagar)} a pagar</span>
          )}
        </div>
      )}

      {mostrarPassadas && passadas.length > 0 && (
        <ul className={styles.faturaList}>
          {passadas.map((f) => (
            <LinhaFatura
              key={f.fatura.id}
              item={f}
              cor={cartaoCor}
              hoje={hoje}
              emExibicao={f.fatura.id === faturaAbertaId}
              onAbrir={onAbrir}
            />
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
  hoje,
  emExibicao,
  onAbrir
}: {
  item: FaturaComTotal
  cor: string
  hoje: string
  emExibicao: boolean
  onAbrir: (faturaId: number) => void
}) {
  const vencida = rotuloVencida(item.fatura, hoje, quitadaPorParciais(item))
  const parcial = contextoDoParcial(item)

  const conteudo = (
    <>
      <BolinhaDeCor cor={cor} />
      <span className={styles.faturaInfo}>
        <span className={styles.faturaMes}>
          {formatarMesReferencia(item.mesReferencia, { capitalizar: true })}
          {emExibicao && <span className={styles.emExibicao}>em exibição</span>}
        </span>
        <span className={styles.faturaSub}>
          <span>{datasDaLinha(item.fatura, hoje)}</span>
          {vencida && (
            <>
              {' · '}
              <span className={styles.avisoPrazo} data-tom="alerta">
                {vencida}
              </span>
            </>
          )}
          {parcial && (
            <>
              {' · '}
              <span>{parcial}</span>
            </>
          )}
        </span>
      </span>
      {/* O que falta pagar (RN-10): sem pagamento parcial, é o total. */}
      <span className={`${styles.faturaTotal} tnum`}>{formatBRL(item.restanteCentavos)}</span>
      <span className={styles.faturaSelo}>
        <Badge variant={statusVariant(item.fatura.status.kind)} />
      </span>
    </>
  )

  // A fatura em exibição não é botão: abrir o que já está aberto não faz nada,
  // e um botão que não faz nada é pior que nenhum.
  if (emExibicao) {
    return (
      <li className={styles.linhaHistorico} aria-current="true">
        <div className={styles.faturaItem} data-em-exibicao="">
          {conteudo}
        </div>
      </li>
    )
  }

  return (
    <li className={styles.linhaHistorico}>
      <button type="button" className={styles.faturaItem} onClick={() => onAbrir(item.fatura.id)}>
        {conteudo}
      </button>
    </li>
  )
}
