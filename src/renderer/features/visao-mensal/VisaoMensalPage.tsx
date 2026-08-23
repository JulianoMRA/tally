import { lazy, Suspense, useMemo, useState } from 'react'
import type { Despesa } from '@domain/entities/despesa'
import { diferencaEmMeses } from '@domain/services/mes-referencia'
import { montarAgendaDoMes } from '@domain/services/montar-agenda-do-mes'
import { hojeIsoLocal } from '@shared/datas-locais'
import type { RecebimentoComContexto } from '@shared/ipc/recebimento'
import { PageContainer } from '../../components/layout/PageContainer'
import { PageHead } from '../../components/layout/PageHead'
import {
  Badge,
  EmptyState,
  Panel,
  RowActions,
  SegmentedControl,
  SeletorMes,
  SortableHeader,
  Table,
  useToast,
  type AcaoLinha,
  type OpcaoSegmentada
} from '../../components/ui'
import { mensagemErro } from '../../lib/mensagem-erro'
import { alfabetico, porData, porNumero } from '../../lib/comparadores'
import { formatBRL } from '../../lib/format-brl'
import { formatarDataIso } from '../../lib/formatar-data'
import { mesAtualReferencia } from '../../lib/mes-atual'
import { pluralizar } from '../../lib/pluralizar'
import { useOrdenacao } from '../../lib/use-ordenacao'
import { useOrcamento } from '../relatorios/hooks/use-orcamento'
import { useTotaisCategoria } from '../relatorios/hooks/use-totais-categoria'
import { AgendaPanel } from './AgendaPanel'
import { FaturasCardCompacto } from './FaturasCardCompacto'
import { montarRanking } from './montar-ranking'
import { PrimeiroUso } from './PrimeiroUso'
import { RankingCategorias } from './RankingCategorias'
import { SaldoHero } from './SaldoHero'
import { useVisaoMensal } from './hooks/use-visao-mensal'
import { diasAteFimDoMes } from './horizonte'
import styles from './visao-mensal.module.css'

// Os painéis de gráficos (recharts) ficam num chunk separado: só são baixados
// quando a aba Análise é aberta.
const PaineisRelatorios = lazy(() => import('../relatorios/PaineisRelatorios'))

type Aba = 'mes' | 'analise'

const ABAS: readonly OpcaoSegmentada<Aba>[] = [
  { valor: 'mes', rotulo: 'Mês' },
  { valor: 'analise', rotulo: 'Análise' }
]

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
  const [aba, setAba] = useState<Aba>('mes')
  const { detalhe, loading, erro } = useVisaoMensal(mes)
  const { totais: totaisCategoria } = useTotaisCategoria(mes)
  const { progresso: orcamento } = useOrcamento(mes)
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

  const hoje = hojeIsoLocal()

  const agenda = useMemo(() => {
    if (!detalhe) return []
    return montarAgendaDoMes({
      faturas: detalhe.faturas.map((f) => ({
        cartaoNome: f.cartaoNome,
        cartaoCor: f.cartaoCor,
        totalCentavos: f.totalCentavos,
        dataFechamento: f.fatura.dataFechamento,
        dataVencimento: f.fatura.dataVencimento,
        status: f.fatura.status
      })),
      recebimentos: detalhe.recebimentos.map((r) => ({
        fonte: r.rendaNome,
        dataEsperada: r.dataEsperada,
        valorCentavos: r.valorCentavos,
        status: r.status
      })),
      hoje
    })
  }, [detalhe, hoje])

  const ranking = useMemo(
    () => montarRanking(totaisCategoria, orcamento),
    [totaisCategoria, orcamento]
  )

  const gastoTotalCategorias = totaisCategoria.reduce((s, t) => s + t.totalCentavos, 0)

  // Base ainda sem nada: sem isso a tela era R$ 0,00 em tudo, sem dizer por
  // onde começar.
  const baseVazia =
    detalhe !== null &&
    detalhe.faturas.length === 0 &&
    detalhe.gastosForaCartao.length === 0 &&
    detalhe.recebimentos.length === 0

  const mesesAdiante = diferencaEmMeses(mesAtualReferencia(), mes)
  const ehProjecao = mesesAdiante > 0

  // Exportar é ação rara e ocupava posição nobre na mesma barra do seletor de
  // mês. `visiveis={0}` empurra as duas para o menu ⋯.
  const acoesExportar: AcaoLinha[] = [
    { label: 'Exportar CSV', onClick: () => exportar('csv'), disabled: exportando },
    { label: 'Exportar PDF', onClick: () => exportar('pdf'), disabled: exportando }
  ]

  const totalFaturasCentavos = detalhe?.faturas.reduce((s, f) => s + f.totalCentavos, 0) ?? 0
  const totalForaCartaoCentavos =
    detalhe?.gastosForaCartao.reduce((s, g) => s + g.valorCentavos, 0) ?? 0

  return (
    <PageContainer>
      {/* O h1 continua sendo o nome da rota: `irPara` (e o leitor de tela) usam
          o par link-de-nav ↔ h1 para confirmar onde a navegação parou. O mês
          quem diz é o seletor ao lado — era ele que estava duplicado, com um
          rótulo "Agosto de 2026" repetindo o que o campo já mostra. */}
      <PageHead title="Visão mensal" subtitle="Faturas, gastos, recebimentos e saldo do mês." />

      <div className={styles.header}>
        <SeletorMes valor={mes} onChange={setMes} label="Mês" />
        {ehProjecao && (
          <span className={styles.headerBadges}>
            <Badge variant="projection" />
            {mesesAdiante > 12 && (
              <span className={styles.distanteBadge}>{`${mesesAdiante} meses adiante`}</span>
            )}
          </span>
        )}
        <span className={styles.headerAcoes}>
          <SegmentedControl
            opcoes={ABAS}
            valor={aba}
            onChange={setAba}
            label="Seção da visão mensal"
            semantica="abas"
          />
          <RowActions acoes={acoesExportar} visiveis={0} contexto="exportar o mês" />
        </span>
      </div>

      {erro && <p className={styles.erro}>{erro}</p>}

      {loading ? (
        <EmptyState title="Carregando…" />
      ) : detalhe ? (
        <div className={styles.layout}>
          {baseVazia && <PrimeiroUso />}

          {aba === 'mes' ? (
            <>
              <div className={styles.gradeTopo}>
                <SaldoHero
                  totais={detalhe.totais}
                  totalFaturasCentavos={totalFaturasCentavos}
                  totalForaCartaoCentavos={totalForaCartaoCentavos}
                  qtdCartoes={detalhe.faturas.length}
                  qtdGastosForaCartao={detalhe.gastosForaCartao.length}
                />
                <AgendaPanel eventos={agenda} diasNoHorizonte={diasAteFimDoMes(mes, hoje)} />
              </div>

              <div className={styles.gradeCorpo}>
                <div className={styles.colunaPrincipal}>
                  <FaturasCardCompacto faturas={detalhe.faturas} />
                  <RankingCategorias linhas={ranking} totalCentavos={gastoTotalCategorias} />
                </div>

                <Panel
                  title="Fora do cartão"
                  meta={formatBRL(totalForaCartaoCentavos)}
                  flush
                  className={styles.painelForaCartao}
                >
                  {detalhe.gastosForaCartao.length === 0 ? (
                    <EmptyState title="Nenhum gasto fora de cartão neste mês." />
                  ) : (
                    <Table>
                      <thead>
                        <tr>
                          <SortableHeader
                            rotulo="Descrição"
                            ativo={gastos.sortBy === 'descricao'}
                            direcao={gastos.sortDir}
                            onSort={() => gastos.handleSort('descricao')}
                          />
                          <SortableHeader
                            rotulo="Forma"
                            ativo={gastos.sortBy === 'forma'}
                            direcao={gastos.sortDir}
                            onSort={() => gastos.handleSort('forma')}
                          />
                          <SortableHeader
                            rotulo="Data"
                            ativo={gastos.sortBy === 'data'}
                            direcao={gastos.sortDir}
                            onSort={() => gastos.handleSort('data')}
                          />
                          <SortableHeader
                            rotulo="Valor"
                            ativo={gastos.sortBy === 'valor'}
                            direcao={gastos.sortDir}
                            onSort={() => gastos.handleSort('valor')}
                            className={styles.colValor}
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {gastos.itensOrdenados.map((g) => (
                          <tr key={g.id}>
                            <td>{g.descricao}</td>
                            <td className="mono">{g.formaPagamento}</td>
                            <td className="mono">{formatarDataIso(g.dataCompra)}</td>
                            <td className={`${styles.colValor} tnum`}>
                              {formatBRL(g.valorCentavos)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Panel>
              </div>

              <p className={styles.rodapeAnalise}>
                Recebimentos, evolução do saldo, evolução por categoria e orçamento estão na aba{' '}
                <strong>Análise</strong>.
              </p>
            </>
          ) : (
            <>
              <Panel
                title="Recebimentos"
                meta={`${detalhe.recebimentos.length} ${pluralizar('entrada', detalhe.recebimentos.length)}`}
                flush
              >
                {detalhe.recebimentos.length === 0 ? (
                  <EmptyState title="Nenhum recebimento neste mês." />
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <SortableHeader
                          rotulo="Fonte"
                          ativo={recebimentos.sortBy === 'fonte'}
                          direcao={recebimentos.sortDir}
                          onSort={() => recebimentos.handleSort('fonte')}
                        />
                        <SortableHeader
                          rotulo="Esperada"
                          ativo={recebimentos.sortBy === 'data'}
                          direcao={recebimentos.sortDir}
                          onSort={() => recebimentos.handleSort('data')}
                        />
                        <SortableHeader
                          rotulo="Status"
                          ativo={recebimentos.sortBy === 'status'}
                          direcao={recebimentos.sortDir}
                          onSort={() => recebimentos.handleSort('status')}
                          className={styles.colStatus}
                        />
                        <SortableHeader
                          rotulo="Valor"
                          ativo={recebimentos.sortBy === 'valor'}
                          direcao={recebimentos.sortDir}
                          onSort={() => recebimentos.handleSort('valor')}
                          className={styles.colValor}
                        />
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
                              <span className={styles.recebimentoStatusBadgePendente}>
                                Esperado
                              </span>
                            )}
                          </td>
                          <td className={`${styles.colValor} tnum`}>
                            {formatBRL(r.valorCentavos)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Panel>

              <Suspense fallback={<EmptyState title="Carregando gráficos…" />}>
                <PaineisRelatorios mes={mes} />
              </Suspense>
            </>
          )}
        </div>
      ) : null}
    </PageContainer>
  )
}
