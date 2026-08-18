import type { GrupoFaturasCartao } from './hooks/use-faturas'
import { formatBRL } from '../../lib/format-brl'
import { formatarDiaMes } from '../../lib/formatar-data'
import { hojeIsoLocal } from '@shared/datas-locais'
import { mesAtualReferencia } from '../../lib/mes-atual'
import { escolherFaturaCorrente } from './escolher-fatura-corrente'
import { rotuloFechamento, rotuloVencida } from './aviso-fechamento'
import { statusVariant } from './status-variant'
import { Badge } from '../../components/ui'
import styles from './faturas.module.css'

type Props = {
  grupos: GrupoFaturasCartao[]
  cartaoSelecionadoId: number | null
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
 */
export function TrilhoCartoes({ grupos, cartaoSelecionadoId, onSelecionar }: Props) {
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

            <span className={`${styles.trilhoTotal} tnum`}>
              {formatBRL(corrente?.totalCentavos ?? 0)}
            </span>

            <span className={styles.trilhoPrazo}>
              {corrente
                ? (aviso ?? `vence ${formatarDiaMes(corrente.fatura.dataVencimento)}`)
                : 'sem fatura'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
