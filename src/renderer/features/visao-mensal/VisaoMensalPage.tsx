import { useState } from 'react'
import {
  diferencaEmMeses,
  mesReferenciaAnterior,
  proxMesReferencia
} from '@domain/services/mes-referencia'
import { PageHead } from '../../components/layout/PageHead'
import { Badge, EmptyState, Input, Panel } from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import { formatarDataIso, formatarMesReferencia } from '../../lib/formatar-data'
import { mesAtualReferencia } from '../../lib/mes-atual'
import { pluralizar } from '../../lib/pluralizar'
import { FaturasCardCompacto } from './FaturasCardCompacto'
import { useVisaoMensal } from './hooks/use-visao-mensal'
import styles from './visao-mensal.module.css'

export default function VisaoMensalPage() {
  const [mes, setMes] = useState(mesAtualReferencia())
  const { detalhe, loading, erro } = useVisaoMensal(mes)

  function irAnterior() {
    setMes(mesReferenciaAnterior(mes))
  }
  function irProximo() {
    setMes(proxMesReferencia(mes))
  }

  const mesesAdiante = diferencaEmMeses(mesAtualReferencia(), mes)
  const ehProjecao = mesesAdiante > 0

  return (
    <div>
      <PageHead title="Visão mensal" subtitle="Faturas, gastos, recebimentos e saldo do mês." />

      <div className={styles.body}>
        <div className={styles.header}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={irAnterior}
            aria-label="Mês anterior"
          >
            ←
          </button>
          <Input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className={styles.mesInput}
            aria-label="Mês"
          />
          <button
            type="button"
            className={styles.navBtn}
            onClick={irProximo}
            aria-label="Próximo mês"
          >
            →
          </button>
          <span className={styles.mesLabel}>
            {formatarMesReferencia(mes, { capitalizar: true })}
          </span>
          {ehProjecao && (
            <span className={styles.headerBadges}>
              <Badge variant="projection" />
              {mesesAdiante > 12 && (
                <span className={styles.distanteBadge}>{`${mesesAdiante} meses adiante`}</span>
              )}
            </span>
          )}
        </div>

        {erro && <p className={styles.erro}>{erro}</p>}

        {loading ? (
          <EmptyState title="Carregando…" />
        ) : detalhe ? (
          <>
            <div className={styles.cards}>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Entradas</span>
                <span className={`${styles.cardValor} ${styles.cardValorIncome}`}>
                  {formatBRL(detalhe.totais.totalEntradasProjetadasCentavos)}
                </span>
                <span className={styles.cardMeta}>
                  {formatBRL(detalhe.totais.totalEntradasRecebidasCentavos)} recebidas
                </span>
              </div>

              <div className={styles.card}>
                <span className={styles.cardLabel}>Faturas</span>
                <span className={`${styles.cardValor} ${styles.cardValorExpense}`}>
                  {formatBRL(detalhe.faturas.reduce((s, f) => s + f.totalCentavos, 0))}
                </span>
                <span className={styles.cardMeta}>
                  {detalhe.faturas.length} {pluralizar('cartão', detalhe.faturas.length, 'ões')}
                </span>
              </div>

              <div className={styles.card}>
                <span className={styles.cardLabel}>Gastos fora de cartão</span>
                <span className={`${styles.cardValor} ${styles.cardValorExpense}`}>
                  {formatBRL(detalhe.gastosForaCartao.reduce((s, g) => s + g.valorCentavos, 0))}
                </span>
                <span className={styles.cardMeta}>
                  {detalhe.gastosForaCartao.length}{' '}
                  {pluralizar('lançamento', detalhe.gastosForaCartao.length)}
                </span>
              </div>
            </div>

            <div className={styles.saldoCard}>
              <div>
                <div className={styles.saldoLabel}>Saldo do mês</div>
                <div className={styles.saldoSub}>
                  Realizado{' '}
                  <span
                    className={
                      detalhe.totais.saldoRealizadoCentavos >= 0 ? styles.positivo : styles.negativo
                    }
                  >
                    {formatBRL(detalhe.totais.saldoRealizadoCentavos)}
                  </span>
                </div>
              </div>
              <div
                className={`${styles.saldoBig} ${
                  detalhe.totais.saldoProjetadoCentavos >= 0 ? styles.positivo : styles.negativo
                }`}
              >
                {formatBRL(detalhe.totais.saldoProjetadoCentavos)}
              </div>
            </div>

            <FaturasCardCompacto faturas={detalhe.faturas} />

            <Panel
              title="Recebimentos"
              meta={`${detalhe.recebimentos.length} ${pluralizar('entrada', detalhe.recebimentos.length)}`}
              flush
              className={styles.panel}
            >
              {detalhe.recebimentos.length === 0 ? (
                <EmptyState title="Nenhum recebimento neste mês." />
              ) : (
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th>Fonte</th>
                      <th>Esperada</th>
                      <th className={styles.colStatus}>Status</th>
                      <th className={styles.colValor}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalhe.recebimentos.map((r) => (
                      <tr key={r.id}>
                        <td>{r.rendaNome ?? '—'}</td>
                        <td className="mono">{formatarDataIso(r.dataEsperada)}</td>
                        <td className={styles.colStatus}>
                          {r.status === 'Recebido' ? (
                            <span className={styles.recebimentoStatusBadgeRecebido}>
                              Recebido {formatarDataIso(r.dataRecebida)}
                            </span>
                          ) : (
                            <span className={styles.recebimentoStatusBadgePendente}>Esperado</span>
                          )}
                        </td>
                        <td className={`${styles.colValor} tnum`}>{formatBRL(r.valorCentavos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel
              title="Gastos fora de cartão"
              meta={`${detalhe.gastosForaCartao.length} ${pluralizar('lançamento', detalhe.gastosForaCartao.length)}`}
              flush
              className={styles.panel}
            >
              {detalhe.gastosForaCartao.length === 0 ? (
                <EmptyState title="Nenhum gasto fora de cartão neste mês." />
              ) : (
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Forma</th>
                      <th>Data</th>
                      <th className={styles.colValor}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalhe.gastosForaCartao.map((g) => (
                      <tr key={g.id}>
                        <td>{g.descricao}</td>
                        <td className="mono">{g.formaPagamento}</td>
                        <td className="mono">{formatarDataIso(g.dataCompra)}</td>
                        <td className={`${styles.colValor} tnum`}>{formatBRL(g.valorCentavos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </>
        ) : null}
      </div>
    </div>
  )
}
