import { useEffect, useMemo, useState } from 'react'
import type { Categoria } from '@domain/entities/categoria'
import {
  EmptyState,
  Field,
  Panel,
  SegmentedControl,
  Select,
  type OpcaoSegmentada
} from '../../components/ui'
import { EvolucaoCategoriaChart } from './components/EvolucaoCategoriaChart'
import { EvolucaoLineChart } from './components/EvolucaoLineChart'
import { OrcamentoPanel } from './components/OrcamentoPanel'
import { useEvolucaoCategoria } from './hooks/use-evolucao-categoria'
import { useEvolucaoSaldo } from './hooks/use-evolucao-saldo'
import styles from './relatorios.module.css'

type Periodo = 6 | 12

const PERIODOS: readonly OpcaoSegmentada<Periodo>[] = [
  { valor: 6, rotulo: '6 meses' },
  { valor: 12, rotulo: '12 meses' }
]

type Props = {
  mes: string
}

export default function PaineisRelatorios({ mes }: Props) {
  const [periodoEvolucao, setPeriodoEvolucao] = useState<Periodo>(6)
  const [periodoCategoria, setPeriodoCategoria] = useState<Periodo>(6)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaIdSelecionada, setCategoriaIdSelecionada] = useState<number | null>(null)

  const { dados: evolucao, loading: loadingEvolucao } = useEvolucaoSaldo(mes, periodoEvolucao)
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
    <>
      <Panel
        className={styles.painel}
        title="Evolução do saldo"
        meta="Entradas, saídas e saldo realizado nos últimos meses"
      >
        <div className={styles.toolbar}>
          <span className={styles.toolbarLabel}>Período:</span>
          <SegmentedControl
            opcoes={PERIODOS}
            valor={periodoEvolucao}
            onChange={setPeriodoEvolucao}
            label="Período da evolução do saldo"
          />
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
        className={styles.painel}
        title="Orçamento por categoria"
        meta="Limite mensal por categoria"
      >
        <OrcamentoPanel mes={mes} categorias={categorias} />
      </Panel>

      <Panel
        className={styles.painel}
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
          <SegmentedControl
            opcoes={PERIODOS}
            valor={periodoCategoria}
            onChange={setPeriodoCategoria}
            label="Período da evolução por categoria"
          />
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
    </>
  )
}
