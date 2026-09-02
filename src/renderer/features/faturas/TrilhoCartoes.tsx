import type { GrupoFaturasCartao } from './hooks/use-faturas'
import { formatBRL } from '../../lib/format-brl'
import { formatarDiaMes, formatarMesReferencia } from '../../lib/formatar-data'
import { hojeIsoLocal } from '@shared/datas-locais'
import { mesAtualReferencia } from '../../lib/mes-atual'
import { escolherFaturaCorrente } from './escolher-fatura-corrente'
import { mesDivergenteDoPainel } from './escopo-do-trilho'
import { rotuloFechamento, rotuloVencida } from './aviso-fechamento'
import { statusVariant } from './status-variant'
import { Badge } from '../../components/ui'
import styles from './faturas.module.css'

type Props = {
  grupos: GrupoFaturasCartao[]
  cartaoSelecionadoId: number | null
  /** Mês da fatura que o painel exibe, para o card admitir quando os dois divergem. */
  mesDoPainel: string | null
  onSelecionar: (cartaoId: number) => void
}

/**
 * Barra de situação dos cartões: um bloco por cartão, sempre com a fatura
 * CORRENTE dele — total, status e prazo — independentemente de qual fatura o
 * painel abaixo está exibindo.
 *
 * Substitui o select de cartão mais o agrupamento por cartão da visão geral,
 * que diziam a mesma coisa em dois lugares (ponto 12). E responde o ponto 13:
 * a lista antiga dava a meses futuros o mesmo peso do corrente.
 *
 * Decisão de ago/2026: o trilho NÃO acompanha o mês do painel. Navegar para
 * março no histórico não muda o trilho — ele responde "como cada cartão está
 * hoje", que é a pergunta que se faz ao abrir a tela.
 *
 * O que faltava era **dizer** isso. O card é ao mesmo tempo o resumo de hoje e
 * o seletor do painel (`aria-pressed`, borda de foco), e seleção cria
 * expectativa de identidade: o que está aceso em cima deveria ser o que está
 * aberto embaixo. Sem nomear o mês, dois totais diferentes conviviam na tela
 * sem nada explicando a diferença — e a leitura era de defeito, não de decisão.
 * Por isso cada card agora nomeia a fatura que exibe, e o card em foco admite
 * quando o painel saiu dela.
 */
export function TrilhoCartoes({ grupos, cartaoSelecionadoId, mesDoPainel, onSelecionar }: Props) {
  const mesAtual = mesAtualReferencia()
  const hoje = hojeIsoLocal()

  return (
    <div className={styles.trilho} role="group" aria-label="Cartões">
      {grupos.map(({ cartao, faturas }) => {
        const corrente = escolherFaturaCorrente(faturas, mesAtual)
        const ativo = cartao.id === cartaoSelecionadoId
        const aviso = corrente
          ? (rotuloVencida(corrente.fatura, hoje) ?? rotuloFechamento(corrente.fatura, hoje))
          : null
        const divergencia = mesDivergenteDoPainel(
          corrente?.mesReferencia ?? null,
          mesDoPainel,
          ativo
        )

        return (
          <button
            key={cartao.id}
            type="button"
            className={`${styles.trilhoItem} ${ativo ? styles.trilhoItemAtivo : ''}`}
            aria-pressed={ativo}
            onClick={() => onSelecionar(cartao.id)}
          >
            <span className={styles.trilhoTopo}>
              <span className={styles.cardChip} style={{ background: cartao.cor }} />
              <span className={styles.trilhoNome}>{cartao.nome}</span>
              {corrente && <Badge variant={statusVariant(corrente.fatura.status.kind)} />}
            </span>

            {corrente && (
              <span className={styles.trilhoEscopo}>
                {formatarMesReferencia(corrente.mesReferencia)}
              </span>
            )}

            <span className={`${styles.trilhoTotal} tnum`}>
              {formatBRL(corrente?.totalCentavos ?? 0)}
            </span>

            <span className={styles.trilhoPrazo}>
              {corrente
                ? (aviso ?? `vence ${formatarDiaMes(corrente.fatura.dataVencimento)}`)
                : 'sem fatura'}
            </span>

            {divergencia && (
              <span className={styles.trilhoDivergencia}>
                painel em {formatarMesReferencia(divergencia)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
