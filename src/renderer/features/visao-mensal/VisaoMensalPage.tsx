import { lazy, Suspense, useState } from 'react'
import type { Despesa } from '@domain/entities/despesa'
import {
  diferencaEmMeses,
  mesReferenciaAnterior,
  proxMesReferencia
} from '@domain/services/mes-referencia'
import type { RecebimentoComContexto } from '@shared/ipc/recebimento'
import { PageContainer } from '../../components/layout/PageContainer'
import { PageHead } from '../../components/layout/PageHead'
import { Badge, Button, EmptyState, Input, Panel, useToast } from '../../components/ui'
import { mensagemErro } from '../../lib/mensagem-erro'
import { alfabetico, porData, porNumero } from '../../lib/comparadores'
import { formatBRL } from '../../lib/format-brl'
import { formatarDataIso, formatarMesReferencia } from '../../lib/formatar-data'
import { mesAtualReferencia } from '../../lib/mes-atual'
import { pluralizar } from '../../lib/pluralizar'
import { useOrdenacao } from '../../lib/use-ordenacao'
import { FaturasCardCompacto } from './FaturasCardCompacto'
import { SaldoCard } from './SaldoCard'
import { useVisaoMensal } from './hooks/use-visao-mensal'
import styles from './visao-mensal.module.css'

// Os painéis de gráficos (recharts) ficam num chunk separado: só são baixados
// quando há dados para renderizar na coluna direita.
const PaineisRelatorios = lazy(() => import('../relatorios/PaineisRelatorios'))

// Comparadores estáveis (módulo) para a ordenação dos painéis. Gastos fora do
// cartão não têm status, então só recebimentos ordenam por status.
const COMPARADORES_RECEBIMENTOS = {
  fonte: alfabetico<RecebimentoComContexto>((r) => r.rendaNome),
  data: porData<RecebimentoComContexto>((r) => r.dataEsperada),
  status: alfabetico<RecebimentoComContexto>((r) => r.status),
  valor: porNumero<RecebimentoComContexto>((r) => r.valorCentavos)
}

const COMPARADORES_GASTOS = {
  descricao: alfabetico<Despesa>((g) => g.descricao),
  forma: alfabetico<Despesa>((g) => g.formaPagamento),
  data: porData<Despesa>((g) => g.dataCompra),
  valor: porNumero<Despesa>((g) => g.valorCentavos)
}

const SEM_RECEBIMENTOS: RecebimentoComContexto[] = []
const SEM_GASTOS: Despesa[] = []

export default function VisaoMensalPage() {
  const [mes, setMes] = useState(mesAtualReferencia())
  const { detalhe, loading, erro } = useVisaoMensal(mes)
  const toast = useToast()
  const [exportando, setExportando] = useState(false)

  async function exportar(formato: 'csv' | 'pdf') {
    setExportando(true)
    try {
      const api = window.api.dados
      const caminho =
        formato === 'csv'
          ? await api.exportarMesCsv({ mesReferencia: mes })
          : await api.exportarMesPdf({ mesReferencia: mes })
      if (caminho) {
        toast.show(`Exportado para ${caminho}`, 'success')
      }
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao exportar o mês.'), 'error')
    } finally {
      setExportando(false)
    }
  }

  const recebimentos = useOrdenacao(
    detalhe?.recebimentos ?? SEM_RECEBIMENTOS,
    COMPARADORES_RECEBIMENTOS,
    'data'
  )
  const gastos = useOrdenacao(detalhe?.gastosForaCartao ?? SEM_GASTOS, COMPARADORES_GASTOS, 'data')

  function irAnterior() {
    setMes(mesReferenciaAnterior(mes))
  }
  function irProximo() {
    setMes(proxMesReferencia(mes))
  }

  const mesesAdiante = diferencaEmMeses(mesAtualReferencia(), mes)
  const ehProjecao = mesesAdiante > 0

  return (
    <PageContainer width="wide">
      <PageHead title="Visão mensal" subtitle="Faturas, gastos, recebimentos e saldo do mês." />

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
        <span className={styles.mesLabel}>{formatarMesReferencia(mes, { capitalizar: true })}</span>
        {ehProjecao && (
          <span className={styles.headerBadges}>
            <Badge variant="projection" />
            {mesesAdiante > 12 && (
              <span className={styles.distanteBadge}>{`${mesesAdiante} meses adiante`}</span>
            )}
          </span>
        )}
        <span className={styles.headerAcoes}>
          <Button variant="ghost" size="sm" disabled={exportando} onClick={() => exportar('csv')}>
            Exportar CSV
          </Button>
          <Button variant="ghost" size="sm" disabled={exportando} onClick={() => exportar('pdf')}>
            Exportar PDF
          </Button>
        </span>
      </div>

      {erro && <p className={styles.erro}>{erro}</p>}

      {loading ? (
        <EmptyState title="Carregando…" />
      ) : detalhe ? (
        <div className={styles.layout}>
          <div className={styles.colunaOperacional}>
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

            <SaldoCard totais={detalhe.totais} />

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
                      <th
                        className={styles.thSortavel}
                        onClick={() => recebimentos.handleSort('fonte')}
                      >
                        Fonte{recebimentos.sortIndicator('fonte')}
                      </th>
                      <th
                        className={styles.thSortavel}
                        onClick={() => recebimentos.handleSort('data')}
                      >
                        Esperada{recebimentos.sortIndicator('data')}
                      </th>
                      <th
                        className={`${styles.colStatus} ${styles.thSortavel}`}
                        onClick={() => recebimentos.handleSort('status')}
                      >
                        Status{recebimentos.sortIndicator('status')}
                      </th>
                      <th
                        className={`${styles.colValor} ${styles.thSortavel}`}
                        onClick={() => recebimentos.handleSort('valor')}
                      >
                        Valor{recebimentos.sortIndicator('valor')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recebimentos.itensOrdenados.map((r) => (
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
                      <th
                        className={styles.thSortavel}
                        onClick={() => gastos.handleSort('descricao')}
                      >
                        Descrição{gastos.sortIndicator('descricao')}
                      </th>
                      <th className={styles.thSortavel} onClick={() => gastos.handleSort('forma')}>
                        Forma{gastos.sortIndicator('forma')}
                      </th>
                      <th className={styles.thSortavel} onClick={() => gastos.handleSort('data')}>
                        Data{gastos.sortIndicator('data')}
                      </th>
                      <th
                        className={`${styles.colValor} ${styles.thSortavel}`}
                        onClick={() => gastos.handleSort('valor')}
                      >
                        Valor{gastos.sortIndicator('valor')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {gastos.itensOrdenados.map((g) => (
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
          </div>

          <div className={styles.colunaGraficos}>
            <Suspense fallback={<EmptyState title="Carregando gráficos…" />}>
              <PaineisRelatorios mes={mes} />
            </Suspense>
          </div>
        </div>
      ) : null}
    </PageContainer>
  )
}
