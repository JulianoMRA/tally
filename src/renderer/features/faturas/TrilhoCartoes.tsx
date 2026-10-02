import { quitadaPorParciais } from '@domain/services/pagamento-parcial'
import type { FaturaComTotal } from '@shared/ipc/fatura'
import type { GrupoFaturasCartao } from './hooks/use-faturas'
import { formatBRL } from '../../lib/format-brl'
import { formatarDiaMes, formatarMesReferencia } from '../../lib/formatar-data'
import { hojeIsoLocal } from '@shared/datas-locais'
import { mesAtualReferencia } from '../../lib/mes-atual'
import { escolherFaturaCorrente } from './escolher-fatura-corrente'
import { mesDivergenteDoPainel } from './escopo-do-trilho'
import { avisoDePrazo, type AvisoDePrazo } from './aviso-fechamento'
import { contextoDoParcial } from './descrever-parcial'
import { statusVariant } from './status-variant'
import { Badge, BolinhaDeCor } from '../../components/ui'
import styles from './faturas.module.css'

type Props = {
  grupos: GrupoFaturasCartao[]
  cartaoSelecionadoId: number | null
  /** Mês da fatura que o painel exibe, para o card admitir quando os dois divergem. */
  mesDoPainel: string | null
  onSelecionar: (cartaoId: number) => void
}

/**
 * A última linha do card. Fatura paga diz quando foi paga — o vencimento dela
 * não pede mais nada. As outras dizem o aviso de prazo, quando há um, ou o dia
 * do vencimento.
 */
function textoDoPrazo(corrente: FaturaComTotal | null, aviso: AvisoDePrazo | null): string {
  if (!corrente) return 'sem fatura'
  const { status, dataVencimento } = corrente.fatura
  if (status.kind === 'Paga') return `paga em ${formatarDiaMes(status.pagaEm)}`
  return aviso?.texto ?? `vence ${formatarDiaMes(dataVencimento)}`
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
 *
 * Ele admitia numa linha a mais ("painel em dezembro de 2026"), que aumentava
 * a fileira inteira e empurrava a página — as setas de navegação inclusive —
 * no primeiro clique para fora da fatura corrente. Agora é a linha do mês que
 * muda, sem mexer na altura do card, e diz o que o clique nele faz: "voltar
 * para outubro de 2026".
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
          ? avisoDePrazo(corrente.fatura, hoje, quitadaPorParciais(corrente))
          : null
        const parcial = corrente ? contextoDoParcial(corrente) : null
        const painelEmOutraFatura =
          mesDivergenteDoPainel(corrente?.mesReferencia ?? null, mesDoPainel, ativo) !== null

        return (
          <button
            key={cartao.id}
            type="button"
            className={[
              styles.trilhoItem,
              ativo ? styles.trilhoItemAtivo : '',
              cartao.ativo ? '' : styles.trilhoItemArquivado
            ]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={ativo}
            onClick={() => onSelecionar(cartao.id)}
          >
            <span className={styles.trilhoTopo}>
              <BolinhaDeCor cor={cartao.cor} />
              <span className={styles.trilhoNome}>{cartao.nome}</span>
              {corrente && <Badge variant={statusVariant(corrente.fatura.status.kind)} />}
            </span>

            {/* O selo de arquivado desce para a linha do mês: na de cima, com o
                do status, o nome do cartão não cabia e virava "Cartao an…".
                A linha existe sempre, mesmo vazia: é ela, com altura fixa, que
                põe o total na mesma altura em todos os cards da fileira. */}
            <span className={styles.trilhoLinhaEscopo}>
              {corrente &&
                (painelEmOutraFatura ? (
                  <span className={styles.trilhoVolta}>
                    voltar para {formatarMesReferencia(corrente.mesReferencia)}
                  </span>
                ) : (
                  <span className={styles.trilhoEscopo}>
                    {formatarMesReferencia(corrente.mesReferencia)}
                  </span>
                ))}
              {!cartao.ativo && <Badge variant="archived" />}
            </span>

            {/* O que falta pagar (RN-10), que sem pagamento parcial é o total.
                Mostrando o total, o card seguia exibindo um valor que o banco
                já não cobrava. */}
            <span className={`${styles.trilhoTotal} tnum`}>
              {formatBRL(corrente?.restanteCentavos ?? 0)}
            </span>

            {parcial && <span className={`${styles.trilhoParcial} tnum`}>{parcial}</span>}

            {/* O tom vem só com o aviso: "vencida há 19 dias" no cinza de
                "vence 05/11" fazia o prazo mais urgente da tela parecer rotina. */}
            <span className={styles.trilhoPrazo} data-tom={aviso?.tom}>
              {textoDoPrazo(corrente, aviso)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
