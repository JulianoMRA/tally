import { useEffect, useMemo, useState } from 'react'
import type { Categoria } from '@domain/entities/categoria'
import { PageHead } from '../../components/layout/PageHead'
import { EmptyState, Field, Input, Panel, Select } from '../../components/ui'
import { mesAtualReferencia } from '../../lib/mes-atual'
import { CategoriaPieChart } from './components/CategoriaPieChart'
import { CategoriaRanking } from './components/CategoriaRanking'
import { EvolucaoCategoriaChart } from './components/EvolucaoCategoriaChart'
import { EvolucaoLineChart } from './components/EvolucaoLineChart'
import { OrcamentoPanel } from './components/OrcamentoPanel'
import { useEvolucaoCategoria } from './hooks/use-evolucao-categoria'
import { useEvolucaoSaldo } from './hooks/use-evolucao-saldo'
import { useTotaisCategoria } from './hooks/use-totais-categoria'
import styles from './relatorios.module.css'

type Periodo = 6 | 12

export default function RelatoriosPage() {
  const [mes, setMes] = useState(mesAtualReferencia)
  const [periodoEvolucao, setPeriodoEvolucao] = useState<Periodo>(6)
  const [periodoCategoria, setPeriodoCategoria] = useState<Periodo>(6)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaIdSelecionada, setCategoriaIdSelecionada] = useState<number | null>(null)

  const { dados: evolucao, loading: loadingEvolucao } = useEvolucaoSaldo(mes, periodoEvolucao)
  const { totais, loading: loadingTotais } = useTotaisCategoria(mes)
  const { dados: evolucaoCat } = useEvolucaoCategoria(categoriaIdSelecionada, mes, periodoCategoria)

  useEffect(() => {
    window.api.categoria.list({ tipo: 'Despesa' }).then((cs) => {
      setCategorias(cs)
      setCategoriaIdSelecionada((atual) => atual ?? cs[0]?.id ?? null)
    })
  }, [])

  const categoriaSelecionada = useMemo(
    () => categorias.find((c) => c.id === categoriaIdSelecionada) ?? null,
    [categorias, categoriaIdSelecionada]
  )

  return (
    <div>
      <PageHead title="Relatórios" subtitle="Comparativos temporais e quebra por categoria." />

      <div className={styles.body}>
        <Panel
          title="Evolução do saldo"
          meta="Entradas, saídas e saldo realizado nos últimos meses"
        >
          <div className={styles.toolbar}>
            <span className={styles.toolbarLabel}>Período:</span>
            <div className={styles.periodoSelector}>
              {([6, 12] as Periodo[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.periodoBtn} ${
                    periodoEvolucao === p ? styles.periodoBtnActive : ''
                  }`}
                  onClick={() => setPeriodoEvolucao(p)}
                >
                  {p} meses
                </button>
              ))}
            </div>
          </div>
          {loadingEvolucao ? (
            <EmptyState title="Carregando…" />
          ) : (
            <div className={styles.chartWrap}>
              <EvolucaoLineChart dados={evolucao} />
            </div>
          )}
        </Panel>

        <Panel
          title="Gastos do mês por categoria"
          meta="Pizza e ranking — combina parcelas de fatura + gastos fora cartão"
        >
          <div className={styles.toolbar}>
            <Field label="Mês">
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
            </Field>
          </div>

          {loadingTotais ? (
            <EmptyState title="Carregando…" />
          ) : totais.length === 0 ? (
            <EmptyState title="Nenhum gasto neste mês." />
          ) : (
            <div className={styles.gastosMesGrid}>
              <div className={styles.chartWrap}>
                <CategoriaPieChart dados={totais} />
              </div>
              <CategoriaRanking dados={totais} />
            </div>
          )}
        </Panel>

        <Panel
          title="Orçamento por categoria"
          meta="Defina um limite mensal por categoria e acompanhe o quanto já foi gasto"
        >
          <OrcamentoPanel mes={mes} categorias={categorias} />
        </Panel>

        <Panel
          title="Evolução por categoria"
          meta="Acompanhe como você vem gastando em uma categoria específica"
        >
          <div className={styles.toolbar}>
            <Field label="Categoria">
              <Select
                value={categoriaIdSelecionada ?? ''}
                onChange={(e) =>
                  setCategoriaIdSelecionada(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">— selecione —</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <span className={styles.toolbarLabel}>Período:</span>
            <div className={styles.periodoSelector}>
              {([6, 12] as Periodo[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.periodoBtn} ${
                    periodoCategoria === p ? styles.periodoBtnActive : ''
                  }`}
                  onClick={() => setPeriodoCategoria(p)}
                >
                  {p} meses
                </button>
              ))}
            </div>
          </div>

          {categoriaSelecionada === null ? (
            <EmptyState title="Selecione uma categoria acima." />
          ) : (
            <div className={styles.chartWrap}>
              <EvolucaoCategoriaChart
                dados={evolucaoCat}
                cor={categoriaSelecionada.cor}
                nome={categoriaSelecionada.nome}
              />
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
