import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Cartao } from '@domain/entities/cartao'
import type { Categoria } from '@domain/entities/categoria'
import type { Despesa } from '@domain/entities/despesa'
import type {
  DespesaUnicaCreditoInput,
  DespesaParceladaCreditoInput,
  DespesaEmAndamentoInput,
  DespesaAssinaturaCreditoInput,
  DespesaUnicaForaCartaoInput,
  DespesaComTags
} from '@shared/ipc/despesa'
import { PageContainer } from '../../components/layout/PageContainer'
import { PageHead } from '../../components/layout/PageHead'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Panel,
  RowActions,
  SegmentedControl,
  SidePanel,
  SortableHeader,
  Select,
  useToast,
  type AcaoLinha,
  type OpcaoSegmentada
} from '../../components/ui'
import { alfabetico, porData, porNumero, type Comparador } from '../../lib/comparadores'
import { formatBRL } from '../../lib/format-brl'
import {
  formatarDataIso,
  formatarDiaPorExtenso,
  formatarMesReferencia
} from '../../lib/formatar-data'
import { mensagemErro } from '../../lib/mensagem-erro'
import { useOrdenacao } from '../../lib/use-ordenacao'
import { DespesaForm } from '../despesas/DespesaForm'
import { EditarDespesaModal } from '../faturas/EditarDespesaModal'
import { EditarAssinaturaModal } from '../assinaturas/EditarAssinaturaModal'
import { agruparPorDia } from './agrupar-por-dia'
import { filtrarPorDescricao } from './filtrar-saidas'
import { montarPreenchimentoDespesa, type PreenchimentoDespesa } from './montar-preenchimento'
import { NotaETagsModal } from './NotaETagsModal'
import { useSaidas } from './hooks/use-saidas'
import styles from './saidas.module.css'

type Filtro = 'todas' | 'foraCartao' | 'parcelada' | 'assinatura'

type UltimaRegistrada = {
  descricao: string
  mesReferencia: string
  cartaoNome: string
  parcelas?: number
  formaForaCartao?: 'Pix' | 'Debito' | 'Dinheiro'
}

type Confirmacao = { tipo: 'cancelar'; despesa: Despesa } | { tipo: 'excluir'; despesa: Despesa }

const COMPARADORES: Record<string, Comparador<DespesaComTags>> = {
  descricao: alfabetico((d) => d.descricao),
  data: porData((d) => d.dataCompra),
  valor: porNumero((d) => d.valorCentavos)
}

function rotuloTipo(d: Despesa): string {
  if (d.tipo === 'Assinatura') return 'Assinatura'
  if (d.tipo === 'Parcelada') return 'Parcelada'
  if (d.formaPagamento === 'Credito') return 'Única'
  return 'Fora do cartão'
}

function pertenceAoFiltro(d: Despesa, filtro: Filtro): boolean {
  switch (filtro) {
    case 'todas':
      return true
    case 'foraCartao':
      return d.tipo === 'Unica' && d.formaPagamento !== 'Credito'
    case 'parcelada':
      return d.tipo === 'Parcelada'
    case 'assinatura':
      return d.tipo === 'Assinatura'
  }
}

const FILTROS: readonly OpcaoSegmentada<Filtro>[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'foraCartao', rotulo: 'Fora do cartão' },
  { valor: 'parcelada', rotulo: 'Parceladas' },
  { valor: 'assinatura', rotulo: 'Assinaturas' }
]

export default function SaidasPage() {
  const { despesas, loading, erro, recarregar } = useSaidas()
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [ultimaRegistrada, setUltimaRegistrada] = useState<UltimaRegistrada | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [mes, setMes] = useState('')
  const [busca, setBusca] = useState('')
  const [tagFiltro, setTagFiltro] = useState('')
  const [preenchimento, setPreenchimento] = useState<PreenchimentoDespesa | null>(null)
  const [dupSeq, setDupSeq] = useState(0)
  const [cadastroAberto, setCadastroAberto] = useState(false)
  const [notaTags, setNotaTags] = useState<DespesaComTags | null>(null)
  const [editandoDespesa, setEditandoDespesa] = useState<Despesa | null>(null)
  const [editandoAssinatura, setEditandoAssinatura] = useState<Despesa | null>(null)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    window.api.cartao.list({ incluirArquivados: true }).then(setCartoes)
    window.api.categoria.list({ tipo: 'Despesa' }).then(setCategorias)
  }, [])

  const cartoesAtivos = useMemo(() => cartoes.filter((c) => c.ativo), [cartoes])

  function nomeCartao(id: number | null): string {
    if (id === null) return '—'
    return cartoes.find((c) => c.id === id)?.nome ?? `#${id}`
  }

  function corCartao(id: number | null): string | undefined {
    if (id === null) return 'var(--ink-3)'
    return cartoes.find((c) => c.id === id)?.cor ?? 'var(--ink-3)'
  }

  function nomeCategoria(id: number): string {
    return categorias.find((c) => c.id === id)?.nome ?? `#${id}`
  }

  const tagsDisponiveis = useMemo(() => {
    const set = new Set<string>()
    for (const d of despesas) for (const t of d.tags) set.add(t)
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [despesas])

  const filtradas = useMemo(() => {
    const porTipo = despesas.filter((d) => {
      if (!pertenceAoFiltro(d, filtro)) return false
      if (filtro === 'foraCartao' && mes && d.dataCompra.slice(0, 7) !== mes) return false
      if (tagFiltro && !d.tags.includes(tagFiltro)) return false
      return true
    })
    return filtrarPorDescricao(porTipo, busca)
  }, [despesas, filtro, mes, busca, tagFiltro])

  // `dupSeq` remonta o DespesaForm: ele guarda o estado dos campos internamente
  // e sem a troca de key um segundo "Nova saída" reabriria com o que sobrou do
  // anterior.
  function abrirCadastro() {
    setPreenchimento(null)
    setDupSeq((n) => n + 1)
    setCadastroAberto(true)
  }

  function fecharCadastro() {
    setCadastroAberto(false)
    setPreenchimento(null)
  }

  // Duplicar abre o painel já preenchido. Antes rolava a página até o topo para
  // revelar o formulário fixo — com o painel, o formulário vem até o usuário.
  function duplicar(despesa: Despesa) {
    setPreenchimento(montarPreenchimentoDespesa(despesa))
    setDupSeq((n) => n + 1)
    setCadastroAberto(true)
  }

  async function handleSalvarNotaETags(input: { nota: string | null; tags: string[] }) {
    if (!notaTags) return
    try {
      await window.api.despesa.definirNotaETags({ despesaId: notaTags.id, ...input })
      toast.show('Nota e tags salvas.', 'success')
      setNotaTags(null)
      await recarregar()
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao salvar nota e tags.'), 'error')
      throw e
    }
  }

  // Editar é a ação primária (fica visível); o resto entra no menu. Assinatura
  // cancelada não tem Editar nem Cancelar — só Duplicar, Nota/Tags e Excluir,
  // como antes.
  function acoesDaLinha(d: DespesaComTags): AcaoLinha[] {
    const ehAssinatura = d.tipo === 'Assinatura'
    const acoes: AcaoLinha[] = []

    if (ehAssinatura) {
      if (d.ativa) acoes.push({ label: 'Editar', onClick: () => setEditandoAssinatura(d) })
    } else {
      acoes.push({ label: 'Editar', onClick: () => setEditandoDespesa(d) })
    }

    acoes.push({ label: 'Duplicar', onClick: () => duplicar(d) })
    acoes.push({ label: 'Nota/Tags', onClick: () => setNotaTags(d) })

    if (ehAssinatura && d.ativa) {
      acoes.push({
        label: 'Cancelar assinatura',
        onClick: () => setConfirmacao({ tipo: 'cancelar', despesa: d }),
        destrutiva: true
      })
    }

    acoes.push({
      label: 'Excluir',
      onClick: () => setConfirmacao({ tipo: 'excluir', despesa: d }),
      destrutiva: true
    })

    return acoes
  }

  const { itensOrdenados, sortBy, sortDir, handleSort } = useOrdenacao(
    filtradas,
    COMPARADORES,
    'data',
    'desc'
  )

  // Agrupa por dia só quando a lista está ordenada por data. Ordenada por valor
  // ou descrição, as datas se intercalam e cada linha viraria seu próprio grupo
  // — ruído em vez de ritmo.
  const agrupado = sortBy === 'data'
  const grupos = useMemo(() => agruparPorDia(itensOrdenados), [itensOrdenados])
  const totalPeriodoCentavos = useMemo(
    () => itensOrdenados.reduce((s, d) => s + d.valorCentavos, 0),
    [itensOrdenados]
  )

  async function registrar<T>(
    acao: () => Promise<T>,
    montarBanner: (resultado: T) => UltimaRegistrada,
    erroMsg: string
  ) {
    try {
      const resultado = await acao()
      setUltimaRegistrada(montarBanner(resultado))
      // Salvou: o painel fecha e o resultado aparece na lista atrás dele. É o
      // "formulário é episódio" — deixá-lo aberto esconderia o que acabou de
      // ser registrado. O erro NÃO fecha: quem errou precisa do que digitou.
      fecharCadastro()
      await recarregar()
    } catch (e) {
      toast.show(mensagemErro(e, erroMsg), 'error')
    }
  }

  async function handleSalvarUnica(input: DespesaUnicaCreditoInput) {
    await registrar(
      () => window.api.despesa.criarUnicaCredito(input),
      (r) => ({
        descricao: r.despesa.descricao,
        mesReferencia: r.fatura.mesReferencia,
        cartaoNome: nomeCartao(input.cartaoId)
      }),
      'Erro ao registrar despesa.'
    )
  }

  async function handleSalvarParcelada(input: DespesaParceladaCreditoInput) {
    await registrar(
      () => window.api.despesa.criarParceladaCredito(input),
      (r) => ({
        descricao: r.despesa.descricao,
        mesReferencia: r.parcelas[0]?.dataReferencia ?? '—',
        cartaoNome: nomeCartao(input.cartaoId),
        parcelas: r.parcelas.length
      }),
      'Erro ao registrar despesa parcelada.'
    )
  }

  async function handleSalvarEmAndamento(input: DespesaEmAndamentoInput) {
    await registrar(
      () => window.api.despesa.criarParceladaEmAndamento(input),
      (r) => ({
        descricao: r.despesa.descricao,
        mesReferencia: r.parcelas[0]?.dataReferencia ?? '—',
        cartaoNome: nomeCartao(input.cartaoId),
        parcelas: r.parcelas.length
      }),
      'Erro ao registrar despesa em andamento.'
    )
  }

  async function handleSalvarUnicaForaCartao(input: DespesaUnicaForaCartaoInput) {
    await registrar(
      () => window.api.despesa.criarUnicaForaCartao(input),
      (r) => ({
        descricao: r.despesa.descricao,
        mesReferencia: r.parcela.dataReferencia,
        cartaoNome: '—',
        formaForaCartao: input.formaPagamento
      }),
      'Erro ao registrar gasto fora de cartão.'
    )
  }

  async function handleSalvarAssinatura(input: DespesaAssinaturaCreditoInput) {
    await registrar(
      () => window.api.despesa.criarAssinaturaCredito(input),
      (r) => ({
        descricao: r.despesa.descricao,
        mesReferencia: r.parcelas[0]?.dataReferencia ?? '—',
        cartaoNome: nomeCartao(input.cartaoId),
        parcelas: r.parcelas.length
      }),
      'Erro ao registrar assinatura.'
    )
  }

  async function handleEditarDespesaConfirmar(input: {
    descricao: string
    categoriaId: number
    valorCentavos: number
    dataCompra?: string
  }) {
    if (!editandoDespesa) return
    try {
      await window.api.despesa.atualizar({ despesaId: editandoDespesa.id, ...input })
      toast.show('Despesa atualizada.', 'success')
      setEditandoDespesa(null)
      await recarregar()
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao atualizar despesa.'), 'error')
      throw e
    }
  }

  async function handleEditarAssinaturaConfirmar(input: {
    descricao: string
    categoriaId: number
    valorCentavos: number
  }) {
    if (!editandoAssinatura) return
    await window.api.despesa.atualizar({ despesaId: editandoAssinatura.id, ...input })
    toast.show('Assinatura atualizada.', 'success')
    setEditandoAssinatura(null)
    await recarregar()
  }

  async function confirmarCancelar(despesa: Despesa) {
    try {
      await window.api.despesa.cancelarAssinatura({ despesaId: despesa.id })
      toast.show(`"${despesa.descricao}" cancelada.`, 'success')
      await recarregar()
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao cancelar assinatura.'), 'error')
    } finally {
      setConfirmacao(null)
    }
  }

  async function confirmarExcluir(despesa: Despesa) {
    try {
      await window.api.despesa.excluir({ despesaId: despesa.id })
      toast.show(`"${despesa.descricao}" excluída.`, 'success')
      await recarregar()
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao excluir despesa.'), 'error')
    } finally {
      setConfirmacao(null)
    }
  }

  return (
    <PageContainer width="wide">
      <PageHead
        title="Saídas"
        subtitle="Cadastre e gerencie despesas, gastos e assinaturas em um só lugar."
      />

      <div className={styles.layout}>
        {ultimaRegistrada && (
          <div className={styles.successBanner}>
            <strong>{ultimaRegistrada.descricao}</strong>
            {ultimaRegistrada.formaForaCartao ? (
              <>
                {' '}
                registrada via <strong>{ultimaRegistrada.formaForaCartao}</strong> em{' '}
                <strong>{formatarMesReferencia(ultimaRegistrada.mesReferencia)}</strong>.
              </>
            ) : (
              <>
                {ultimaRegistrada.parcelas
                  ? ` registrada com ${ultimaRegistrada.parcelas} parcelas a partir de `
                  : ' registrada na fatura '}
                <strong>{formatarMesReferencia(ultimaRegistrada.mesReferencia)}</strong> · cartão{' '}
                <strong>{ultimaRegistrada.cartaoNome}</strong>.
              </>
            )}
          </div>
        )}

        {/* Sem cartão ativo, registrar no crédito falha só no submit. O aviso
            fica na página, não no painel: quem chega aqui precisa vê-lo antes
            de abrir o formulário, e gasto por Pix, débito ou dinheiro não
            depende de cartão nenhum. */}
        {cartoesAtivos.length === 0 && (
          <div className={styles.avisoSemCartao}>
            <div>
              <strong>Nenhum cartão cadastrado.</strong> Você ainda pode registrar gastos por Pix,
              débito ou dinheiro — mas despesa no crédito precisa de um cartão.
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate('/cartoes')}>
              Cadastrar cartão
            </Button>
          </div>
        )}

        <div className={styles.toolbar}>
          <SegmentedControl
            opcoes={FILTROS}
            valor={filtro}
            onChange={setFiltro}
            label="Filtrar lançamentos por tipo"
          />
          {filtro === 'foraCartao' && (
            <Field label="Mês">
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
            </Field>
          )}
          {tagsDisponiveis.length > 0 && (
            <Select
              value={tagFiltro}
              onChange={(e) => setTagFiltro(e.target.value)}
              aria-label="Filtrar por tag"
              className={styles.filtroTag}
            >
              <option value="">Todas as tags</option>
              {tagsDisponiveis.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
          <div className={styles.buscaWrap}>
            <Input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por descrição…"
              aria-label="Buscar saídas"
            />
          </div>
          <Button size="sm" onClick={abrirCadastro}>
            + Nova saída
          </Button>
        </div>

        {erro && <p className={styles.erro}>{erro}</p>}

        {/* O total do período era o número que faltava (ponto 11): a lista
              mostrava nove lançamentos soltos e nenhuma soma. */}
        <Panel
          title="Lançamentos"
          meta={`${itensOrdenados.length} · ${formatBRL(totalPeriodoCentavos)}`}
          flush
        >
          {loading ? (
            <EmptyState title="Carregando…" />
          ) : itensOrdenados.length === 0 ? (
            <EmptyState title="Nenhuma saída para este filtro." />
          ) : (
            <div className={styles.tabelaWrap}>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <SortableHeader
                      rotulo="Descrição"
                      ativo={sortBy === 'descricao'}
                      direcao={sortDir}
                      onSort={() => handleSort('descricao')}
                    />
                    <th>Tipo</th>
                    <th>Categoria</th>
                    <SortableHeader
                      rotulo="Data"
                      ativo={sortBy === 'data'}
                      direcao={sortDir}
                      onSort={() => handleSort('data')}
                    />
                    <SortableHeader
                      rotulo="Valor"
                      ativo={sortBy === 'valor'}
                      direcao={sortDir}
                      onSort={() => handleSort('valor')}
                      className={styles.colValor}
                    />
                    <th className={styles.colAcoes} aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((grupo) => (
                    <Fragment key={grupo.data}>
                      {agrupado && (
                        <tr className={styles.grupoDia}>
                          <td colSpan={6}>
                            <div className={styles.grupoDiaConteudo}>
                              <span className={styles.grupoDiaData}>
                                {formatarDiaPorExtenso(grupo.data)}
                              </span>
                              <span className={styles.grupoDiaTotal}>
                                {formatBRL(grupo.totalCentavos)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                      {grupo.itens.map((d) => {
                        const ehAssinatura = d.tipo === 'Assinatura'
                        return (
                          <tr key={d.id} className={!d.ativa ? styles.itemCancelada : undefined}>
                            <td>
                              <div className={styles.descricaoCell}>
                                <span
                                  className={styles.chip}
                                  style={{ background: corCartao(d.cartaoId) }}
                                />
                                <span>{d.descricao}</span>
                                {!d.ativa && <Badge variant="archived" label="Cancelada" />}
                              </div>
                              {d.tags.length > 0 && (
                                <div className={styles.tagCell}>
                                  {d.tags.map((t) => (
                                    <span key={t} className={styles.tagCellChip}>
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>
                              <span className={styles.tagTipo}>{rotuloTipo(d)}</span>
                            </td>
                            <td>{nomeCategoria(d.categoriaId)}</td>
                            <td className="mono">{formatarDataIso(d.dataCompra)}</td>
                            <td className={`${styles.colValor} tnum`}>
                              {formatBRL(d.valorCentavos)}
                              {ehAssinatura ? '/mês' : ''}
                            </td>
                            <td className={styles.colAcoes}>
                              <RowActions acoes={acoesDaLinha(d)} contexto={d.descricao} />
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {cadastroAberto && (
        <SidePanel
          titulo="Nova saída"
          descricao="Compra no crédito, gasto fora do cartão, parcelamento ou assinatura."
          onFechar={fecharCadastro}
          fecharNoOverlay={false}
        >
          <DespesaForm
            key={dupSeq}
            cartoes={cartoesAtivos}
            categorias={categorias}
            preenchimento={preenchimento ?? undefined}
            onSalvarUnica={handleSalvarUnica}
            onSalvarUnicaForaCartao={handleSalvarUnicaForaCartao}
            onSalvarParcelada={handleSalvarParcelada}
            onSalvarEmAndamento={handleSalvarEmAndamento}
            onSalvarAssinatura={handleSalvarAssinatura}
          />
        </SidePanel>
      )}

      {notaTags && (
        <NotaETagsModal
          despesa={notaTags}
          onConfirmar={handleSalvarNotaETags}
          onCancelar={() => setNotaTags(null)}
        />
      )}

      {editandoDespesa && (
        <EditarDespesaModal
          despesa={editandoDespesa}
          categorias={categorias}
          onConfirmar={handleEditarDespesaConfirmar}
          onCancelar={() => setEditandoDespesa(null)}
        />
      )}

      {editandoAssinatura && (
        <EditarAssinaturaModal
          assinatura={editandoAssinatura}
          categorias={categorias}
          onConfirmar={handleEditarAssinaturaConfirmar}
          onCancelar={() => setEditandoAssinatura(null)}
        />
      )}

      {confirmacao?.tipo === 'cancelar' && (
        <ConfirmDialog
          title={`Cancelar "${confirmacao.despesa.descricao}"?`}
          body="As ocorrências em faturas abertas serão removidas. Ocorrências em faturas já fechadas ou pagas permanecem no histórico."
          confirmText="Cancelar assinatura"
          confirmVariant="danger"
          onConfirm={() => confirmarCancelar(confirmacao.despesa)}
          onCancel={() => setConfirmacao(null)}
        />
      )}
      {confirmacao?.tipo === 'excluir' && (
        <ConfirmDialog
          title={`Excluir "${confirmacao.despesa.descricao}"?`}
          body="A despesa e TODAS as parcelas pendentes serão removidas. Esta ação é irreversível e bloqueia se houver parcela já paga."
          confirmText="Excluir"
          confirmVariant="danger"
          onConfirm={() => confirmarExcluir(confirmacao.despesa)}
          onCancel={() => setConfirmacao(null)}
        />
      )}
    </PageContainer>
  )
}
