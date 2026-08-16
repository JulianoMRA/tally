import { EmptyState, Panel } from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import type { LinhaRanking } from './montar-ranking'
import styles from './visao-mensal.module.css'

type Props = {
  linhas: LinhaRanking[]
  totalCentavos: number
}

const CLASSE_USO = {
  ok: styles.usoOk,
  alerta: styles.usoAlerta,
  estourado: styles.usoEstourado
} as const

/**
 * Ranking de categorias do mês com o limite de orçamento embutido como marca
 * vertical (RF-ORC-02, leitura). Um objeto no lugar dos dois painéis que
 * mostravam o mesmo gasto.
 */
export function RankingCategorias({ linhas, totalCentavos }: Props) {
  return (
    <Panel
      title="Para onde foi"
      meta={formatBRL(totalCentavos)}
      actions={
        linhas.some((l) => l.limite !== null) ? (
          <span className={styles.legendaLimite}>marca vertical = limite definido</span>
        ) : null
      }
      flush
    >
      {linhas.length === 0 ? (
        <EmptyState title="Nenhum gasto neste mês." />
      ) : (
        <ol className={styles.rankLista}>
          {linhas.map((linha) => (
            <li key={linha.categoriaId} className={styles.rankLinha}>
              <span className={styles.rankNome}>{linha.nome}</span>

              <span className={styles.rankTrilho}>
                <span
                  className={styles.rankBarra}
                  style={{ width: `${linha.larguraPct}%`, background: linha.cor }}
                />
                {linha.limite && (
                  <span
                    className={`${styles.rankMarcaLimite} ${
                      linha.limite.foraDeEscala ? styles.rankMarcaForaDeEscala : ''
                    }`}
                    style={{ left: `${linha.limite.posicaoPct}%` }}
                    title={
                      linha.limite.foraDeEscala
                        ? `Limite ${formatBRL(linha.limite.limiteCentavos)} — acima da escala do gráfico`
                        : `Limite ${formatBRL(linha.limite.limiteCentavos)}`
                    }
                  />
                )}
              </span>

              <span className={`${styles.rankValor} tnum`}>{formatBRL(linha.totalCentavos)}</span>

              {linha.limite ? (
                <span className={`${styles.rankUso} ${CLASSE_USO[linha.limite.status]} tnum`}>
                  {linha.limite.usoPct}% do limite
                </span>
              ) : (
                <span className={`${styles.rankUso} tnum`}>{Math.round(linha.fatiaPct)}%</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
