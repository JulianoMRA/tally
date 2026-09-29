import { useMemo, useState } from 'react'
import type { Cartao } from '@domain/entities/cartao'
import type { Categoria } from '@domain/entities/categoria'
import type { OcorrenciaDoMes } from '@shared/ipc/despesa'
import { PageContainer } from '../../components/layout/PageContainer'
import { PageHead } from '../../components/layout/PageHead'
import {
  Button,
  EmptyState,
  Field,
  Input,
  Panel,
  Select,
  SortableHeader,
  Table
} from '../../components/ui'
import { alfabetico, porData, porNumero, type Comparador } from '../../lib/comparadores'
import { useOrdenacao } from '../../lib/use-ordenacao'
import { useCargaAuxiliar } from '../../hooks/use-carga-auxiliar'
import { formatBRL } from '../../lib/format-brl'
import { formatarMesReferencia } from '../../lib/formatar-data'
import { mesAtualReferencia } from '../../lib/mes-atual'
import { pluralizar } from '../../lib/pluralizar'
import { filtrarPorDescricao } from '../saidas/filtrar-saidas'
import { useBusca } from './hooks/use-busca'
import { MENSAGEM_PROBLEMA, periodoPadrao, validarPeriodo } from './periodo-busca'
import styles from './busca.module.css'

const TODAS = ''

/**
 * O mes ordena pela `dataReferencia`, e nao pelo rotulo por extenso: "abril"
 * vem antes de "janeiro" em ordem alfabetica, e a coluna e cronologica.
 */
const COMPARADORES: Record<string, Comparador<OcorrenciaDoMes>> = {
  mes: porData((o) => o.dataReferencia),
  descricao: alfabetico((o) => o.descricao),
  valor: porNumero((o) => o.impactoCentavos)
}

/**
 * RF-DES-22 — busca que atravessa meses.
 *
 * Saídas mostra um mês de cada vez, por decisão (RF-DES-14): o agrupamento por
 * cartão é a fatura daquele mês, e o subtotal bate com o total da fatura. Isso
 * deixou o app sem resposta para duas perguntas que o uso diário faz — "onde
 * está aquela compra de fevereiro" e "quanto gastei com isso no ano" —, e é o
 * que esta tela responde.
 *
 * Não substitui Saídas: aqui não se registra, não se edita e não se agrupa por
 * origem. É uma consulta, e o resultado é uma lista plana com um total.
 */
export default function BuscaPage() {
  const [periodo, setPeriodo] = useState(() => periodoPadrao(mesAtualReferencia()))
  const [texto, setTexto] = useState('')
  const [categoriaId, setCategoriaId] = useState<string>(TODAS)
  const [tag, setTag] = useState<string>(TODAS)
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [tagsConhecidas, setTagsConhecidas] = useState<string[]>([])

  const { resultados, carregando, erro, buscar } = useBusca()

  useCargaAuxiliar(
    () => window.api.cartao.list({ incluirArquivados: true }),
    setCartoes,
    'Erro ao listar cartões.'
  )
  useCargaAuxiliar(() => window.api.categoria.list(), setCategorias, 'Erro ao listar categorias.')
  useCargaAuxiliar(() => window.api.despesa.listarTags(), setTagsConhecidas, 'Erro ao listar tags.')

  const problema = validarPeriodo(periodo)

  function nomeCategoria(id: number): string {
    return categorias.find((c) => c.id === id)?.nome ?? `#${id}`
  }

  /** A origem do dinheiro: o cartão, quando há; a forma, quando não. */
  function origem(o: { cartaoId: number | null; formaPagamento: string }): string {
    if (o.cartaoId === null) return o.formaPagamento
    return cartoes.find((c) => c.id === o.cartaoId)?.nome ?? `#${o.cartaoId}`
  }

  /**
   * A peneira fina roda aqui, e não no SQL: a busca por texto ignora acento
   * (`filtrarPorDescricao`, o mesmo helper de Saídas — sem ele as duas telas
   * divergiriam para a mesma consulta), e a tag já veio no resultado. O SQL
   * limitou o volume pelo período.
   */
  const filtrados = useMemo(() => {
    if (resultados === null) return null
    const porFiltro = resultados.filter((o) => {
      if (categoriaId !== TODAS && String(o.categoriaId) !== categoriaId) return false
      if (tag !== TODAS && !o.tags.includes(tag)) return false
      return true
    })
    return filtrarPorDescricao(porFiltro, texto)
  }, [resultados, categoriaId, tag, texto])

  /**
   * Ordenação por cabeçalho, como em Saídas.
   *
   * `useOrdenacao` não aceita `null`, e "ainda não buscou" precisa ser
   * distinguível de "buscou e não achou" — daí a lista vazia aqui e o `null`
   * preservado em `filtrados` para o estado inicial da tela.
   */
  const { itensOrdenados, sortBy, sortDir, handleSort } = useOrdenacao(
    filtrados ?? [],
    COMPARADORES,
    'mes',
    'desc'
  )

  const totalCentavos = useMemo(
    () => itensOrdenados.reduce((s, o) => s + o.impactoCentavos, 0),
    [itensOrdenados]
  )

  async function submeter(e: React.FormEvent) {
    e.preventDefault()
    if (problema) return
    await buscar(periodo)
  }

  return (
    <PageContainer>
      <PageHead
        title="Busca"
        subtitle="Procura lançamentos em vários meses de uma vez, por descrição, categoria ou tag."
      />

      <Panel title="Filtros">
        <form className={styles.filtros} onSubmit={submeter}>
          <div className={styles.linhaPeriodo}>
            <Field label="De" required>
              <Input
                type="month"
                value={periodo.mesInicio}
                onChange={(e) => setPeriodo({ ...periodo, mesInicio: e.target.value })}
                aria-label="Mês inicial"
              />
            </Field>
            <Field label="Até" required>
              <Input
                type="month"
                value={periodo.mesFim}
                onChange={(e) => setPeriodo({ ...periodo, mesFim: e.target.value })}
                aria-label="Mês final"
              />
            </Field>
          </div>

          <Field label="Descrição contém">
            <Input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex: uber"
            />
          </Field>

          <div className={styles.linhaPeriodo}>
            <Field label="Categoria">
              <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                <option value={TODAS}>Todas as categorias</option>
                {categorias.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tag">
              <Select value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value={TODAS}>Todas as tags</option>
                {tagsConhecidas.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {problema && <p className={styles.erro}>{MENSAGEM_PROBLEMA[problema]}</p>}

          <div className={styles.acoes}>
            <Button type="submit" variant="primary" disabled={carregando || problema !== null}>
              {carregando ? 'Buscando…' : 'Buscar'}
            </Button>
          </div>
        </form>
      </Panel>

      {erro && <p className={styles.erro}>{erro}</p>}

      {filtrados !== null && !erro && (
        <Panel
          title="Resultados"
          meta={
            filtrados.length > 0
              ? `${filtrados.length} ${pluralizar('lançamento', filtrados.length)} · ${formatBRL(totalCentavos)}`
              : undefined
          }
          flush
        >
          {filtrados.length === 0 ? (
            <EmptyState
              title="Nenhum lançamento encontrado"
              description="Tente ampliar o período ou afrouxar os filtros."
            />
          ) : (
            <Table densidade="compacta">
              <thead>
                <tr>
                  <SortableHeader
                    rotulo="Mês"
                    ativo={sortBy === 'mes'}
                    direcao={sortDir}
                    onSort={() => handleSort('mes')}
                  />
                  <SortableHeader
                    rotulo="Descrição"
                    ativo={sortBy === 'descricao'}
                    direcao={sortDir}
                    onSort={() => handleSort('descricao')}
                  />
                  <th>Categoria</th>
                  <th>Origem</th>
                  <th>Parcela</th>
                  <SortableHeader
                    rotulo="Impacto"
                    ativo={sortBy === 'valor'}
                    direcao={sortDir}
                    onSort={() => handleSort('valor')}
                    className={styles.colValor}
                    alinhamento="direita"
                  />
                </tr>
              </thead>
              <tbody>
                {itensOrdenados.map((o) => (
                  <tr key={o.parcelaId}>
                    <td className="tnum">{formatarMesReferencia(o.dataReferencia.slice(0, 7))}</td>
                    <td>
                      {o.descricao}
                      {o.tags.length > 0 && (
                        <span className={styles.tags}>
                          {o.tags.map((t) => (
                            <span key={t} className={styles.tag}>
                              {t}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td>{nomeCategoria(o.categoriaId)}</td>
                    <td>{origem(o)}</td>
                    <td className="mono">{o.rotuloParcela}</td>
                    <td className={`${styles.colValor} tnum`}>{formatBRL(o.impactoCentavos)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      )}

      {filtrados === null && !erro && !carregando && (
        <EmptyState
          title="Escolha o período e busque"
          description="A busca abre nos últimos 12 meses. Meses futuros só trazem o que já foi projetado."
        />
      )}
    </PageContainer>
  )
}
