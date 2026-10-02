import type { BalancoMensal } from '@shared/ipc/visao-mensal'
import { formatBRL } from '../../lib/format-brl'
import { pluralizar } from '../../lib/pluralizar'
import styles from './visao-mensal.module.css'

type Props = {
  totais: BalancoMensal
  /** Quanto as faturas pesam no mês: a soma do que falta pagar de cada uma (RN-10). */
  totalFaturasCentavos: number
  /** Soma dos pagamentos parciais das faturas do mês; zero quando não há nenhum. */
  pagoParcialFaturasCentavos: number
  totalForaCartaoCentavos: number
  qtdCartoes: number
  qtdGastosForaCartao: number
}

type Fatia = {
  chave: string
  rotulo: string
  valorCentavos: number
  nota: string
  classeBarra: string
  classeBorda: string
}

function largura(valorCentavos: number, totalCentavos: number): string {
  if (totalCentavos <= 0) return '0%'
  return `${(valorCentavos / totalCentavos) * 100}%`
}

/**
 * Hero da visão mensal. O saldo projetado é a resposta da tela e vem primeiro,
 * em corpo display; o saldo contando só o que já entrou fica como nota de apoio
 * no mesmo bloco, para os dois números não competirem (antes o projetado era
 * grande e verde e o realizado uma linha de 12px no subtítulo).
 *
 * RN-08 intacto: só a apresentação muda. O rótulo da linha de apoio segue
 * "Só entradas recebidas" e nunca "Realizado" — a palavra sugere um regime de
 * caixa que a regra não tem, já que as saídas contam mesmo em fatura não paga.
 *
 * Com pagamento parcial (RN-10) a fatura pesa o que falta pagar dela, e o hero
 * diz isso em dois lugares: a nota da fatia "Faturas" ganha "R$ X já pagos",
 * espelho de "R$ X já na conta" das entradas, e o texto de apoio troca
 * "integralmente" por "descontados os pagamentos parciais". Sem a nota, a
 * fatia mostraria menos do que o card de faturas diz que foi comprado, sem
 * explicar para onde foi a diferença.
 */
export function SaldoHero({
  totais,
  totalFaturasCentavos,
  pagoParcialFaturasCentavos,
  totalForaCartaoCentavos,
  qtdCartoes,
  qtdGastosForaCartao
}: Props) {
  const temParcial = pagoParcialFaturasCentavos > 0
  const notaCartoes = `${qtdCartoes} ${pluralizar('cartão', qtdCartoes, 'ões')}`
  // Espaços não-quebráveis (U+00A0) em "R$ X já pagos": na janela padrão a
  // nota não cabe numa linha, e com espaço comum quebrava em "… já / pagos".
  // Presa, a quebra cai no "·", e as duas metades ficam inteiras.
  const notaJaPagos = `${formatBRL(pagoParcialFaturasCentavos)} já pagos`
  const fatias: Fatia[] = [
    {
      chave: 'entradas',
      rotulo: 'Entrou / vai entrar',
      valorCentavos: totais.totalEntradasProjetadasCentavos,
      nota: `${formatBRL(totais.totalEntradasRecebidasCentavos)} já na conta`,
      classeBarra: styles.fatiaEntradas,
      classeBorda: styles.bordaEntradas
    },
    {
      chave: 'faturas',
      rotulo: 'Faturas',
      valorCentavos: totalFaturasCentavos,
      nota: temParcial ? `${notaCartoes} · ${notaJaPagos}` : notaCartoes,
      classeBarra: styles.fatiaFaturas,
      classeBorda: styles.bordaFaturas
    },
    {
      chave: 'foraCartao',
      rotulo: 'Fora do cartão',
      valorCentavos: totalForaCartaoCentavos,
      nota: `${qtdGastosForaCartao} ${pluralizar('lançamento', qtdGastosForaCartao)}`,
      classeBarra: styles.fatiaForaCartao,
      classeBorda: styles.bordaForaCartao
    }
  ]

  const somaFatias = fatias.reduce((s, f) => s + f.valorCentavos, 0)
  const negativo = totais.saldoProjetadoCentavos < 0

  return (
    <section className={styles.hero} aria-labelledby="heroLabel">
      <div className={styles.heroTopo}>
        <h2 id="heroLabel" className={styles.heroLabel}>
          Sobra projetada do mês
        </h2>
        <p className={styles.heroApoio}>
          Só entradas recebidas{' '}
          <strong className={styles.heroApoioValor}>
            {formatBRL(totais.saldoRealizadoCentavos)}
          </strong>
        </p>
      </div>

      <div className={styles.heroNumeroLinha}>
        <strong className={`${styles.heroNumero} ${negativo ? styles.heroNumeroNegativo : ''}`}>
          {formatBRL(totais.saldoProjetadoCentavos)}
        </strong>
        <span className={styles.heroNota}>
          se tudo que está previsto entrar e sair acontecer.{' '}
          {temParcial
            ? 'Saídas contam mesmo em fatura não paga, descontados os pagamentos parciais.'
            : 'Saídas contam integralmente, mesmo em fatura não paga.'}
        </span>
      </div>

      {somaFatias > 0 && (
        <div className={styles.heroBarra} aria-hidden="true">
          {fatias.map((f) => (
            <span
              key={f.chave}
              className={f.classeBarra}
              style={{ width: largura(f.valorCentavos, somaFatias) }}
            />
          ))}
        </div>
      )}

      <dl className={styles.heroComposicao}>
        {fatias.map((f) => (
          <div key={f.chave} className={`${styles.heroFatia} ${f.classeBorda}`}>
            <dt className={styles.heroFatiaRotulo}>{f.rotulo}</dt>
            <dd className={`${styles.heroFatiaValor} tnum`}>{formatBRL(f.valorCentavos)}</dd>
            <dd className={styles.heroFatiaNota}>{f.nota}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
