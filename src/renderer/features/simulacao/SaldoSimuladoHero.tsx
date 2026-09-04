import type { ResultadoSimulacao } from '@domain/services/calcular-simulacao'
import { formatBRL } from '../../lib/format-brl'
import { pluralizar } from '../../lib/pluralizar'
import styles from './simulacao.module.css'

type Props = {
  resultado: ResultadoSimulacao
  qtdItensAtivos: number
  qtdItensDesligados: number
  origemBase: string
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
  return `${(Math.abs(valorCentavos) / totalCentavos) * 100}%`
}

/**
 * Resposta da tela de Simulação: o saldo que sobraria se as hipóteses da lista
 * acontecessem. Mesma gramática visual do hero da Visão mensal — número grande,
 * barra de composição, fatias — de propósito: é o mesmo tipo de leitura.
 *
 * O rótulo diz **simulado**, nunca "projetado" nem "previsto". Essas duas
 * palavras já significam, no resto do app, dado real que ainda não aconteceu;
 * reusá-las aqui sugeriria que este número entra na RN-08, e ele não entra.
 */
export function SaldoSimuladoHero({
  resultado,
  qtdItensAtivos,
  qtdItensDesligados,
  origemBase
}: Props) {
  const fatias: Fatia[] = [
    {
      chave: 'base',
      rotulo: 'Ponto de partida',
      valorCentavos: resultado.baseCentavos,
      nota: origemBase,
      classeBarra: styles.fatiaBase,
      classeBorda: styles.bordaBase
    },
    {
      chave: 'entradas',
      rotulo: 'Entradas simuladas',
      valorCentavos: resultado.totalEntradasCentavos,
      nota: 'hipótese, não recebimento',
      classeBarra: styles.fatiaEntradas,
      classeBorda: styles.bordaEntradas
    },
    {
      chave: 'saidas',
      rotulo: 'Saídas simuladas',
      valorCentavos: resultado.totalSaidasCentavos,
      nota: 'hipótese, não despesa',
      classeBarra: styles.fatiaSaidas,
      classeBorda: styles.bordaSaidas
    }
  ]

  const somaFatias = fatias.reduce((s, f) => s + Math.abs(f.valorCentavos), 0)
  const negativo = resultado.saldoSimuladoCentavos < 0

  const desligados =
    qtdItensDesligados > 0
      ? ` · ${qtdItensDesligados} ${pluralizar('desligada', qtdItensDesligados)} fora da conta`
      : ''

  return (
    <section className={styles.hero} aria-labelledby="simuladoLabel">
      <div className={styles.heroTopo}>
        <h2 id="simuladoLabel" className={styles.heroLabel}>
          Saldo simulado
        </h2>
        <p className={styles.heroApoio}>
          {qtdItensAtivos} {pluralizar('hipótese', qtdItensAtivos, 's')} na conta
          {desligados}
        </p>
      </div>

      <div className={styles.heroNumeroLinha}>
        <strong
          className={`${styles.heroNumero} ${negativo ? styles.heroNumeroNegativo : ''}`}
          data-saldo-simulado=""
        >
          {formatBRL(resultado.saldoSimuladoCentavos)}
        </strong>
        <span className={styles.heroNota}>
          se tudo o que está na lista acontecer. Rascunho: nada aqui vira despesa, renda ou fatura.
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
