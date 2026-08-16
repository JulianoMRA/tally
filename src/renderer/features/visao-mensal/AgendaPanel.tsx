import type { EventoAgenda } from '@domain/services/montar-agenda-do-mes'
import { EmptyState, Panel } from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import { formatarDiaMesAbreviado } from '../../lib/formatar-data'
import { pluralizar } from '../../lib/pluralizar'
import styles from './visao-mensal.module.css'

type Props = {
  eventos: EventoAgenda[]
  diasNoHorizonte: number
}

type LinhaAgenda = {
  nome: string
  meta: string
  valor: string | null
  classeValor: string
}

function descrever(evento: EventoAgenda): LinhaAgenda {
  switch (evento.kind) {
    case 'FechamentoFatura':
      return {
        nome: `${evento.cartaoNome} fecha`,
        meta: `${formatBRL(evento.totalCentavos)} acumulados`,
        valor: null,
        classeValor: styles.agendaValorNeutro
      }
    case 'VencimentoFatura':
      return {
        nome: `Fatura ${evento.cartaoNome}`,
        meta: 'vencimento',
        valor: `-${formatBRL(evento.totalCentavos)}`,
        classeValor: styles.agendaValorSaida
      }
    case 'RecebimentoPrevisto':
      return {
        nome: evento.fonte ?? 'Recebimento avulso',
        meta: 'entrada esperada',
        valor: `+${formatBRL(evento.valorCentavos)}`,
        classeValor: styles.agendaValorEntrada
      }
  }
}

/**
 * RF-VIS-07 — os eventos que compõem o saldo projetado, um a um.
 *
 * Sem esta lista o projetado do hero só pode ser aceito: ele depende de faturas
 * que ainda vão vencer e de entradas que ainda não caíram, e nenhuma das duas
 * aparecia em lugar nenhum da tela.
 */
export function AgendaPanel({ eventos, diasNoHorizonte }: Props) {
  return (
    <Panel
      title="Ainda vai acontecer"
      meta={`próximos ${diasNoHorizonte} ${pluralizar('dia', diasNoHorizonte)}`}
      flush
    >
      {eventos.length === 0 ? (
        <EmptyState title="Nada previsto até o fim do mês." />
      ) : (
        <ul className={styles.agendaLista}>
          {eventos.map((evento, i) => {
            const linha = descrever(evento)
            return (
              <li key={`${evento.kind}-${evento.data}-${i}`} className={styles.agendaItem}>
                <span className={`${styles.agendaDia} mono`}>
                  {formatarDiaMesAbreviado(evento.data)}
                </span>
                <span className={styles.agendaTexto}>
                  <span className={styles.agendaNome}>{linha.nome}</span>
                  <span className={styles.agendaMeta}>{linha.meta}</span>
                </span>
                {linha.valor !== null && (
                  <span className={`${styles.agendaValor} ${linha.classeValor} tnum`}>
                    {linha.valor}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
