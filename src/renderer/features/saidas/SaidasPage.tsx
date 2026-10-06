import { Fragment, useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Cartao } from '@domain/entities/cartao'
import type { Categoria } from '@domain/entities/categoria'
import type { Despesa } from '@domain/entities/despesa'
import type {
  DespesaUnicaCreditoInput,
  DespesaParceladaCreditoInput,
  DespesaEmAndamentoInput,
  DespesaAssinaturaCreditoInput,
  DespesaAssinaturaForaCartaoInput,
  DespesaUnicaForaCartaoInput,
  DespesaComTags,
  NotaETags,
  OcorrenciaDoMes
} from '@shared/ipc/despesa'
import { PageContainer } from '../../components/layout/PageContainer'
import { PageHead } from '../../components/layout/PageHead'
import {
  Badge,
  BolinhaDeCor,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Panel,
  RowActions,
  SegmentedControl,
  Select,
  SeletorMes,
  SidePanel,
  SortableHeader,
  Table,
  useToast,
  type AcaoLinha
} from '../../components/ui'
import { alfabetico, porData, porNumero, type Comparador } from '../../lib/comparadores'
import { formatBRL } from '../../lib/format-brl'
import { formatarMesReferencia } from '../../lib/formatar-data'
import { mensagemErro } from '../../lib/mensagem-erro'
import { mesAtualReferencia } from '../../lib/mes-atual'
import { hojeIsoLocal } from '@shared/datas-locais'
import { useOrdenacao } from '../../lib/use-ordenacao'
import { DespesaForm } from '../despesas/DespesaForm'
import { motivoDoBloqueioDeExclusao, travaDeValorEData } from '../despesas/acoes-da-despesa'
import { DialogoExcluirDespesa } from '../despesas/DialogoExcluirDespesa'
import { EditarDespesaModal } from '../faturas/EditarDespesaModal'
import { EditarAssinaturaModal } from '../assinaturas/EditarAssinaturaModal'
import { RotuloCategoria } from '../categorias/RotuloCategoria'
import { descreverDataDaOcorrencia } from './descrever-data-da-ocorrencia'
import { agruparPorCategoria, agruparPorOrigem, type GrupoOcorrencias } from './agrupar-ocorrencias'
import { colunasDoAgrupamento, origemDaOcorrencia, type Agrupamento } from './colunas-de-saidas'
import {
  FILTROS_PADRAO,
  contarPorTipo,
  filtrarOcorrencias,
  temFiltroAtivo,
  type FiltroDeTipo,
  type FiltrosDeSaidas
} from './filtrar-saidas'
import { opcoesDeCategoria, opcoesDeOrigem, opcoesDeTag } from './opcoes-de-filtro'
import { LinhaDeGrupo } from './LinhaDeGrupo'
import { resumoDoPainel } from './resumo-do-painel'
import { montarPreenchimentoDespesa, type PreenchimentoDespesa } from './montar-preenchimento'
import { NotaETagsModal } from './NotaETagsModal'
import { useOcorrencias } from './hooks/use-ocorrencias'
import { useSaidas } from './hooks/use-saidas'
import styles from './saidas.module.css'
import { useCargaAuxiliar } from '../../hooks/use-carga-auxiliar'

type UltimaRegistrada = {
  descricao: string
  mesReferencia: string
  cartaoNome: string
  parcelas?: number
  formaForaCartao?: 'Pix' | 'Debito' | 'Dinheiro'
}

type Confirmacao = { tipo: 'cancelar'; despesa: Despesa } | { tipo: 'excluir'; despesa: Despesa }

const AGRUPAMENTOS: readonly { valor: Agrupamento; rotulo: string }[] = [
  { valor: 'origem', rotulo: 'Origem' },
  { valor: 'categoria', rotulo: 'Categoria' },
  { valor: 'nenhum', rotulo: 'Nenhum' }
]

const COMPARADORES: Record<string, Comparador<OcorrenciaDoMes>> = {
  descricao: alfabetico((o) => o.descricao),
  compra: porData((o) => o.dataCompra),
  valor: porNumero((o) => o.impactoCentavos)
}

/**
 * Célula da coluna Compra. O tom de apoio separa "aconteceu neste dia" de
 * "corre desde", que é a diferença entre uma compra e uma assinatura.
 */
function CelulaDeCompra({ ocorrencia }: { ocorrencia: OcorrenciaDoMes }) {
  const { texto, apoio } = descreverDataDaOcorrencia(ocorrencia)
  return <span className={apoio ? styles.compraApoio : 'tnum'}>{texto}</span>
}

/**
 * Abas por tipo, que partem o mês: somadas, dão "Todas". A origem ("Fora do
 * cartão") saiu daqui para um filtro próprio — as abas antigas misturavam os
 * dois eixos e não somavam.
 */
const FILTROS_DE_TIPO: readonly { valor: FiltroDeTipo; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'avista', rotulo: 'À vista' },
  { valor: 'parcelada', rotulo: 'Parceladas' },
  { valor: 'assinatura', rotulo: 'Assinaturas' }
]

export default function SaidasPage() {
  const [mes, setMes] = useState(mesAtualReferencia())
  const { ocorrencias, loading, erro, recarregar } = useOcorrencias(mes)
  // As ações da linha (editar, duplicar, excluir) operam na despesa-mestre, que
  // a ocorrência não carrega — ela traz o impacto do mês, não o valor cheio nem
  // o total de parcelas. Esta lista é só o índice para o RowActions.
  const { despesas, recarregar: recarregarDespesas } = useSaidas()
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [ultimaRegistrada, setUltimaRegistrada] = useState<UltimaRegistrada | null>(null)
  // Sobrevive à troca de mês (acompanhar uma categoria mês a mês) e volta ao
  // padrão ao sair da tela, como antes.
  const [filtros, setFiltros] = useState<FiltrosDeSaidas>(FILTROS_PADRAO)
  const [preenchimento, setPreenchimento] = useState<PreenchimentoDespesa | null>(null)
  const [dupSeq, setDupSeq] = useState(0)
  const [cadastroAberto, setCadastroAberto] = useState(false)
  const [notaTags, setNotaTags] = useState<DespesaComTags | null>(null)
  const [editandoDespesa, setEditandoDespesa] = useState<Despesa | null>(null)
  // RF-DES-10: por que valor e data não mudam, vindo da ocorrência que abriu o
  // modal. A despesa-mestre não sabe em que fatura a compra caiu.
  const [travaDaEdicao, setTravaDaEdicao] = useState<string | undefined>(undefined)
  const [editandoAssinatura, setEditandoAssinatura] = useState<Despesa | null>(null)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)
  const toast = useToast()
  const navigate = useNavigate()

  useCargaAuxiliar(
    () => window.api.cartao.list({ incluirArquivados: true }),
    setCartoes,
    'Erro ao listar cartões.'
  )
  // Com as arquivadas, como os cartões: uma parcela de categoria arquivada
  // aparecia como "#7" (RF-CAT-02). Quem só pode escolher entre ativas — o
  // cadastro — recebe `categoriasAtivas`; os modais de edição filtram sozinhos.
  useCargaAuxiliar(
    () => window.api.categoria.list({ incluirArquivados: true }),
    setCategorias,
    'Erro ao listar categorias.'
  )

  const cartoesAtivos = useMemo(() => cartoes.filter((c) => c.ativo), [cartoes])
  const categoriasAtivas = useMemo(() => categorias.filter((c) => c.ativo), [categorias])
  const categoriaPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])
  const cartaoPorId = useMemo(() => new Map(cartoes.map((c) => [c.id, c])), [cartoes])

  function nomeCartao(id: number | null): string {
    if (id === null) return '—'
    return cartaoPorId.get(id)?.nome ?? `#${id}`
  }

  function celulaDeCategoria(id: number) {
    const categoria = categoriaPorId.get(id)
    if (!categoria) return `#${id}`
    return (
      <RotuloCategoria nome={categoria.nome} arquivada={!categoria.ativo} cor={categoria.cor} />
    )
  }

  // A bolinha sem cor reserva o lugar: "Pix" começa na mesma posição que o nome
  // de um cartão.
  function celulaDeOrigem(o: OcorrenciaDoMes) {
    const { texto, cor } = origemDaOcorrencia(o, cartaoPorId)
    return (
      <span className={styles.origemCelula}>
        <BolinhaDeCor cor={cor} />
        {texto}
      </span>
    )
  }

  const despesaPorId = useMemo(() => new Map(despesas.map((d) => [d.id, d])), [despesas])

  function mudarFiltro<K extends keyof FiltrosDeSaidas>(campo: K, valor: FiltrosDeSaidas[K]) {
    setFiltros((atuais) => ({ ...atuais, [campo]: valor }))
  }

  function limparFiltros() {
    setFiltros(FILTROS_PADRAO)
  }

  // A contagem entra no rótulo do próprio filtro: dizer "Parceladas 2" antes do
  // clique poupa o clique quando a resposta é zero, e dá a composição do mês de
  // relance. Ela respeita os outros filtros — é o que apareceria com o clique.
  const opcoesDeTipo = useMemo(() => {
    const contagem = contarPorTipo(ocorrencias, filtros)
    return FILTROS_DE_TIPO.map((f) => ({
      valor: f.valor,
      rotulo: `${f.rotulo} ${contagem[f.valor]}`
    }))
  }, [ocorrencias, filtros])

  const origensDoMes = useMemo(
    () => opcoesDeOrigem(ocorrencias, cartoes, filtros.origem),
    [ocorrencias, cartoes, filtros.origem]
  )
  const categoriasDoMes = useMemo(
    () => opcoesDeCategoria(ocorrencias, categorias, filtros.categoria),
    [ocorrencias, categorias, filtros.categoria]
  )
  const tagsDoMes = useMemo(() => opcoesDeTag(ocorrencias, filtros.tag), [ocorrencias, filtros.tag])

  const filtradas = useMemo(() => filtrarOcorrencias(ocorrencias, filtros), [ocorrencias, filtros])
  const filtroAtivo = temFiltroAtivo(filtros)

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
  function duplicar(despesa: DespesaComTags) {
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
      await Promise.all([recarregar(), recarregarDespesas()])
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao salvar nota e tags.'), 'error')
      throw e
    }
  }

  /**
   * RF-DES-21 — marcar/desmarcar a ocorrência do mês como paga.
   *
   * Só existe sem fatura: com fatura, quem marca é o pagamento dela (RN-06), e
   * a ação nem aparece no menu. A data usada é hoje — a mesma escolha de
   * "Marcar recebido" em Rendas, e pelo mesmo motivo: pedir a data num modal
   * para o caso normal (paguei agora) cobra um passo de quase todo mundo.
   */
  async function alternarPagamento(o: OcorrenciaDoMes) {
    const marcando = o.statusParcela !== 'Paga'
    try {
      if (marcando) {
        await window.api.despesa.marcarOcorrenciaPaga({
          parcelaId: o.parcelaId,
          dataPagamento: hojeIsoLocal()
        })
      } else {
        await window.api.despesa.desmarcarOcorrenciaPaga({ parcelaId: o.parcelaId })
      }
      toast.show(marcando ? 'Ocorrência marcada como paga.' : 'Pagamento desfeito.', 'success')
      await recarregar()
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao atualizar o pagamento.'), 'error')
    }
  }

  // Editar é a ação primária (fica visível); o resto entra no menu. Assinatura
  // cancelada não tem Editar nem Cancelar — só Duplicar, Nota/Tags e Excluir,
  // como antes.
  function acoesDaLinha(d: DespesaComTags, o: OcorrenciaDoMes): AcaoLinha[] {
    const ehAssinatura = d.tipo === 'Assinatura'
    const acoes: AcaoLinha[] = []

    if (ehAssinatura) {
      if (d.ativa) acoes.push({ label: 'Editar', onClick: () => setEditandoAssinatura(d) })
    } else {
      acoes.push({
        label: 'Editar',
        onClick: () => {
          setTravaDaEdicao(travaDeValorEData(d.tipo, o.statusFatura))
          setEditandoDespesa(d)
        }
      })
    }

    if (o.faturaId === null) {
      acoes.push({
        label: o.statusParcela === 'Paga' ? 'Desmarcar pagamento' : 'Marcar como paga',
        onClick: () => alternarPagamento(o)
      })
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

    // RF-DES-09: o bloqueio vem do main, que olha todas as parcelas da despesa.
    // Excluir era oferecido em toda linha, e o diálogo avisava que a ação
    // "bloqueia se houver parcela já paga": a falha vinha depois do
    // "irreversível". Como em Faturas, o item fica desabilitado e diz por quê.
    const bloqueio = motivoDoBloqueioDeExclusao(o.statusParcela, o.motivoBloqueioExclusao)
    acoes.push({
      label: 'Excluir',
      onClick: () => setConfirmacao({ tipo: 'excluir', despesa: d }),
      disabled: bloqueio !== null,
      destrutiva: true,
      title: bloqueio ?? 'Excluir despesa inteira'
    })

    return acoes
  }

  const { itensOrdenados, sortBy, sortDir, handleSort } = useOrdenacao(
    filtradas,
    COMPARADORES,
    'compra',
    'desc'
  )

  /**
   * O agrupamento é controle próprio: Origem (padrão), Categoria ou Nenhum.
   *
   * Antes ele era função da ordenação: ordenar por Compra achatava os grupos.
   * Cada metade se justificava sozinha — "ordenar por Compra é o pedido
   * explícito pela leitura cronológica" e "a tela abre por Compra, decrescente"
   * —, mas juntas produziam algo que ninguém escolheu: **a tela abria sem o
   * agrupamento**, e a seção por cartão com subtotal, que é o que faz o número
   * bater com o total da fatura (RF-DES-14), só aparecia depois de clicar em
   * outro cabeçalho.
   *
   * Separar as duas coisas resolve nos dois sentidos: o agrupamento fica
   * visível na abertura, e a leitura cronológica achatada continua alcançável
   * por um controle que a nomeia. A ordenação segue agindo dentro de cada
   * grupo. Por categoria, as seções respondem "para onde foi o dinheiro" com
   * as linhas embaixo — o ranking da Visão mensal dá os números, não as linhas.
   */
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('origem')
  const idAgrupamento = useId()

  const grupos: GrupoOcorrencias[] = useMemo(() => {
    if (agrupamento === 'origem') return agruparPorOrigem(itensOrdenados, cartoes)
    if (agrupamento === 'categoria') return agruparPorCategoria(itensOrdenados, categorias)
    // Bloco único e sem rótulo: a lista cronológica não tem cabeçalho de seção
    // nem subtotal, porque somar "o mês inteiro" já é o resumo do painel.
    return [{ chave: 'cronologico', rotulo: '', itens: [...itensOrdenados], totalCentavos: 0 }]
  }, [itensOrdenados, cartoes, categorias, agrupamento])

  const colunas = colunasDoAgrupamento(agrupamento)
  const mostraCategoria = colunas.includes('categoria')
  const mostraOrigem = colunas.includes('origem')
  const colunasAntesDoValor = colunas.indexOf('valor')

  // Soma IMPACTO, não valor de compra: é o que torna o número somável e o que
  // faz o subtotal de cada cartão bater com o total da fatura.
  const totalDoMesCentavos = useMemo(
    () => itensOrdenados.reduce((s, o) => s + o.impactoCentavos, 0),
    [itensOrdenados]
  )

  const resumo = resumoDoPainel(itensOrdenados.length, ocorrencias.length, totalDoMesCentavos)

  /**
   * RF-DES-13 no cadastro — grava nota e tags logo após criar a despesa.
   *
   * São duas chamadas, e não uma: os seis canais de criação teriam de aceitar
   * `nota` e `tags` no schema, e os seis métodos do repositório teriam de
   * escrevê-los dentro da própria transação. Reusar `definirNotaETags`, que já
   * é o caminho do modal de edição e já tem teste, custa um round-trip local a
   * mais e nenhuma mudança de contrato.
   *
   * O preço é não ser atômico, e ele é aceitável AQUI: tags e nota são
   * metadados por definição (RF-DES-13) — não afetam valor, parcela nem status
   * de fatura. Se a segunda chamada falhar, a despesa está criada e correta, o
   * usuário vê o aviso e pode etiquetar pelo menu da linha. Falhar de verdade
   * exigiria o SQLite recusar uma escrita microssegundos depois de aceitar
   * outra, e nesse cenário a criação também teria falhado.
   */
  async function gravarNotaETags(despesaId: number, meta: NotaETags) {
    if (meta.nota === null && meta.tags.length === 0) return
    try {
      await window.api.despesa.definirNotaETags({ despesaId, ...meta })
    } catch (e) {
      toast.show(
        mensagemErro(e, 'A despesa foi criada, mas a nota e as tags não foram salvas.'),
        'error'
      )
    }
  }

  async function registrar<T extends { despesa: Despesa }>(
    acao: () => Promise<T>,
    montarBanner: (resultado: T) => UltimaRegistrada,
    erroMsg: string,
    meta?: NotaETags
  ) {
    try {
      const resultado = await acao()
      if (meta) await gravarNotaETags(resultado.despesa.id, meta)
      const banner = montarBanner(resultado)
      setUltimaRegistrada(banner)
      // Salta para o mês em que o lançamento caiu. Sem isto, registrar uma
      // compra depois do fechamento — que o RN-01 manda para a fatura seguinte
      // — fecharia o painel numa lista onde ela não aparece. O banner diz em
      // qual fatura entrou; a lista tem que mostrar.
      const mesDoLancamento = banner.mesReferencia.slice(0, 7)
      if (/^\d{4}-\d{2}$/.test(mesDoLancamento) && mesDoLancamento !== mes) {
        setMes(mesDoLancamento)
      }
      // Salvou: o painel fecha e o resultado aparece na lista atrás dele. É o
      // "formulário é episódio" — deixá-lo aberto esconderia o que acabou de
      // ser registrado. O erro NÃO fecha: quem errou precisa do que digitou.
      fecharCadastro()
      await Promise.all([recarregar(), recarregarDespesas()])
    } catch (e) {
      toast.show(mensagemErro(e, erroMsg), 'error')
    }
  }

  async function handleSalvarUnica(input: DespesaUnicaCreditoInput, meta: NotaETags) {
    await registrar(
      () => window.api.despesa.criarUnicaCredito(input),
      (r) => ({
        descricao: r.despesa.descricao,
        mesReferencia: r.fatura.mesReferencia,
        cartaoNome: nomeCartao(input.cartaoId)
      }),
      'Erro ao registrar despesa.',
      meta
    )
  }

  async function handleSalvarParcelada(input: DespesaParceladaCreditoInput, meta: NotaETags) {
    await registrar(
      () => window.api.despesa.criarParceladaCredito(input),
      (r) => ({
        descricao: r.despesa.descricao,
        mesReferencia: r.parcelas[0]?.dataReferencia ?? '—',
        cartaoNome: nomeCartao(input.cartaoId),
        parcelas: r.parcelas.length
      }),
      'Erro ao registrar despesa parcelada.',
      meta
    )
  }

  async function handleSalvarEmAndamento(input: DespesaEmAndamentoInput, meta: NotaETags) {
    await registrar(
      () => window.api.despesa.criarParceladaEmAndamento(input),
      (r) => ({
        descricao: r.despesa.descricao,
        mesReferencia: r.parcelas[0]?.dataReferencia ?? '—',
        cartaoNome: nomeCartao(input.cartaoId),
        parcelas: r.parcelas.length
      }),
      'Erro ao registrar despesa em andamento.',
      meta
    )
  }

  async function handleSalvarUnicaForaCartao(input: DespesaUnicaForaCartaoInput, meta: NotaETags) {
    await registrar(
      () => window.api.despesa.criarUnicaForaCartao(input),
      (r) => ({
        descricao: r.despesa.descricao,
        mesReferencia: r.parcela.dataReferencia,
        cartaoNome: '—',
        formaForaCartao: input.formaPagamento
      }),
      'Erro ao registrar gasto fora de cartão.',
      meta
    )
  }

  async function handleSalvarAssinatura(input: DespesaAssinaturaCreditoInput, meta: NotaETags) {
    await registrar(
      () => window.api.despesa.criarAssinaturaCredito(input),
      (r) => ({
        descricao: r.despesa.descricao,
        mesReferencia: r.parcelas[0]?.dataReferencia ?? '—',
        cartaoNome: nomeCartao(input.cartaoId),
        parcelas: r.parcelas.length
      }),
      'Erro ao registrar assinatura.',
      meta
    )
  }

  // RF-DES-19 — so a recorrente sem cartao tem limite; a de credito nao passa
  // este callback e o campo nem aparece no modal.
  async function handleAlterarLimite(despesaId: number, recorreAte: string | null) {
    await window.api.despesa.atualizarLimiteRecorrencia({ despesaId, recorreAte })
    await recarregar()
  }

  async function handleSalvarAssinaturaForaCartao(
    input: DespesaAssinaturaForaCartaoInput,
    meta: NotaETags
  ) {
    await registrar(
      () => window.api.despesa.criarAssinaturaForaCartao(input),
      (r) => ({
        descricao: r.despesa.descricao,
        mesReferencia: r.parcelas[0]?.dataReferencia ?? '—',
        cartaoNome: input.formaPagamento,
        parcelas: r.parcelas.length
      }),
      'Erro ao registrar despesa recorrente.',
      meta
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
      await Promise.all([recarregar(), recarregarDespesas()])
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
      await Promise.all([recarregar(), recarregarDespesas()])
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
      await Promise.all([recarregar(), recarregarDespesas()])
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao excluir despesa.'), 'error')
    } finally {
      setConfirmacao(null)
    }
  }

  return (
    <PageContainer>
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

        {/* Barra de cima: só navegação de mês e a ação primária. Os filtros
            desceram para dentro do painel, encostados no cabeçalho da tabela —
            eles agem sobre a tabela, e flutuando aqui não tinham vínculo
            nenhum com as colunas. */}
        <div className={styles.toolbar}>
          <SeletorMes valor={mes} onChange={setMes} label="Mês" />
          {/* Primária, como "+ Novo avulso" em Rendas: é a ação mais usada da
              tela, e secundária ela perdia para a aba ativa dos filtros. */}
          <Button
            variant="primary"
            size="sm"
            className={styles.acaoPrimaria}
            onClick={abrirCadastro}
          >
            + Nova saída
          </Button>
        </div>

        {erro && <p className={styles.erro}>{erro}</p>}

        {/* O total do período era o número que faltava (ponto 11): a lista
              mostrava nove lançamentos soltos e nenhuma soma. */}
        <Panel
          title="Lançamentos"
          meta={
            resumo && (
              <>
                <span>{resumo.contagem}</span>
                {' · '}
                <span className={styles.metaTotal}>{formatBRL(resumo.totalCentavos)}</span>
              </>
            )
          }
          flush
        >
          {/* Duas linhas: o tipo e a busca, que valem para qualquer mês, em
              cima; os filtros que vêm do mês (origem, categoria, tag) embaixo,
              com o agrupamento fechando à direita. Não cabem numa linha só na
              janela padrão. */}
          <div className={styles.filtros}>
            <div className={styles.filtrosLinha}>
              <SegmentedControl
                opcoes={opcoesDeTipo}
                valor={filtros.tipo}
                onChange={(tipo) => mudarFiltro('tipo', tipo)}
                label="Filtrar lançamentos por tipo"
              />
              <div className={styles.buscaWrap}>
                <Input
                  type="search"
                  value={filtros.busca}
                  onChange={(e) => mudarFiltro('busca', e.target.value)}
                  placeholder="Buscar por descrição…"
                  aria-label="Buscar saídas"
                />
              </div>
            </div>
            <div className={styles.filtrosLinha}>
              <Select
                value={filtros.origem}
                onChange={(e) => mudarFiltro('origem', e.target.value)}
                aria-label="Filtrar por origem"
                className={styles.filtroSelect}
              >
                <option value="">Todas as origens</option>
                {origensDoMes.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </Select>
              <Select
                value={filtros.categoria}
                onChange={(e) => mudarFiltro('categoria', e.target.value)}
                aria-label="Filtrar por categoria"
                className={styles.filtroSelect}
              >
                <option value="">Todas as categorias</option>
                {categoriasDoMes.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.rotulo}
                  </option>
                ))}
              </Select>
              {/* Só com tag no mês ou uma tag escolhida: quem não usa tag não
                  paga um select vazio, e quem filtrou continua vendo o filtro
                  num mês sem tags. */}
              {tagsDoMes.length > 0 && (
                <Select
                  value={filtros.tag}
                  onChange={(e) => mudarFiltro('tag', e.target.value)}
                  aria-label="Filtrar por tag"
                  className={styles.filtroSelect}
                >
                  <option value="">Todas as tags</option>
                  {tagsDoMes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              )}
              {filtroAtivo && (
                <Button variant="ghost" size="sm" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              )}
              {/* Ao lado dos filtros porque é da mesma família: muda como a
                  lista se apresenta, não o que ela contém. */}
              <div className={styles.agrupar}>
                <label htmlFor={idAgrupamento} className={styles.agruparRotulo}>
                  Agrupar por
                </label>
                <Select
                  id={idAgrupamento}
                  value={agrupamento}
                  onChange={(e) =>
                    setAgrupamento(
                      AGRUPAMENTOS.find((a) => a.valor === e.target.value)?.valor ?? 'origem'
                    )
                  }
                  className={styles.agruparSelect}
                >
                  {AGRUPAMENTOS.map((a) => (
                    <option key={a.valor} value={a.valor}>
                      {a.rotulo}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* Dois vazios diferentes: o mês não tem lançamento (nada a limpar),
              ou os filtros esconderam tudo. A tela usava a segunda frase nos
              dois casos, inclusive sem filtro nenhum. */}
          {loading ? (
            <EmptyState title="Carregando…" />
          ) : ocorrencias.length === 0 ? (
            <EmptyState title={`Nenhuma saída em ${formatarMesReferencia(mes)}.`} />
          ) : itensOrdenados.length === 0 ? (
            <EmptyState
              title="Nenhuma saída para este filtro."
              action={
                <Button variant="secondary" size="sm" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <div className={styles.tabelaWrap}>
              <Table densidade="compacta">
                <thead>
                  <tr>
                    <SortableHeader
                      rotulo="Descrição"
                      ativo={sortBy === 'descricao'}
                      direcao={sortDir}
                      onSort={() => handleSort('descricao')}
                      className={styles.colDescricao}
                    />
                    {mostraCategoria && <th>Categoria</th>}
                    {mostraOrigem && <th>Origem</th>}
                    <SortableHeader
                      rotulo="Compra"
                      ativo={sortBy === 'compra'}
                      direcao={sortDir}
                      onSort={() => handleSort('compra')}
                      className={styles.colCompra}
                    />
                    <th className={styles.colParcela}>Parcela</th>
                    <SortableHeader
                      rotulo="Neste mês"
                      ativo={sortBy === 'valor'}
                      direcao={sortDir}
                      onSort={() => handleSort('valor')}
                      className={styles.colValor}
                      alinhamento="direita"
                    />
                    <th className={styles.colAcoes} aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((grupo) => (
                    <Fragment key={grupo.chave}>
                      {/* Rótulo vazio é o bloco cronológico: sem cabeçalho de
                          seção, porque não há seção. */}
                      {grupo.rotulo !== '' && (
                        <LinhaDeGrupo
                          rotulo={grupo.rotulo}
                          cor={grupo.cor}
                          arquivada={grupo.arquivada}
                          totalCentavos={grupo.totalCentavos}
                          colunasDoRotulo={colunasAntesDoValor}
                        />
                      )}
                      {grupo.itens.map((o) => {
                        const despesa = despesaPorId.get(o.despesaId)
                        return (
                          <tr
                            key={o.parcelaId}
                            className={!o.ativa ? styles.itemCancelada : undefined}
                          >
                            <td>
                              <div className={styles.descricaoCell}>
                                <span>{o.descricao}</span>
                                {!o.ativa && <Badge variant="archived" label="Cancelada" />}
                              </div>
                              {o.tags.length > 0 && (
                                <div className={styles.tagCell}>
                                  {o.tags.map((t) => (
                                    <span key={t} className={styles.tagCellChip}>
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            {mostraCategoria && (
                              <td className={styles.colCategoria}>
                                {celulaDeCategoria(o.categoriaId)}
                              </td>
                            )}
                            {mostraOrigem && (
                              <td className={styles.colOrigem}>{celulaDeOrigem(o)}</td>
                            )}
                            <td className={styles.colCompra}>
                              <CelulaDeCompra ocorrencia={o} />
                            </td>
                            <td className={styles.colParcela}>
                              <span className={styles.parcelaComSelo}>
                                {/* "à vista" é o caso comum e vai em tom de
                                    apoio: é a parcela e a mensalidade que a
                                    leitura procura, mesmo princípio do selo
                                    "Paga" logo abaixo. */}
                                <span
                                  className={`${styles.parcelaRotulo} mono`}
                                  data-tom={o.tipo === 'Unica' ? 'apoio' : undefined}
                                >
                                  {o.rotuloParcela}
                                </span>
                                {/* O valor da compra mora aqui, ao lado da
                                    parcela que ele explica: "1/8 de R$ 979,92".
                                    Na coluna de valor ele se lia colado ao
                                    impacto, e a coluna tinha dois números em
                                    umas linhas e um nas outras. */}
                                {o.origemCentavos !== null && (
                                  <span className={`${styles.origem} tnum`}>
                                    {' '}
                                    de {formatBRL(o.origemCentavos)}
                                  </span>
                                )}
                                {/* Só quando paga. Carimbar "Pendente" em toda
                                    linha diria o padrão em voz alta e afogaria
                                    a exceção, que é o que a leitura procura. */}
                                {o.statusParcela === 'Paga' && <Badge variant="paid" />}
                              </span>
                            </td>
                            <td className={`${styles.colValor} tnum`}>
                              <span className={styles.impacto}>{formatBRL(o.impactoCentavos)}</span>
                            </td>
                            <td className={styles.colAcoes}>
                              {despesa && (
                                <RowActions
                                  acoes={acoesDaLinha(despesa, o)}
                                  contexto={o.descricao}
                                />
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </Table>
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
            categorias={categoriasAtivas}
            preenchimento={preenchimento ?? undefined}
            onSalvarUnica={handleSalvarUnica}
            onSalvarUnicaForaCartao={handleSalvarUnicaForaCartao}
            onSalvarParcelada={handleSalvarParcelada}
            onSalvarEmAndamento={handleSalvarEmAndamento}
            onSalvarAssinatura={handleSalvarAssinatura}
            onSalvarAssinaturaForaCartao={handleSalvarAssinaturaForaCartao}
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
          travaValorEData={travaDaEdicao}
          onConfirmar={handleEditarDespesaConfirmar}
          onCancelar={() => setEditandoDespesa(null)}
        />
      )}

      {editandoAssinatura && (
        <EditarAssinaturaModal
          assinatura={editandoAssinatura}
          categorias={categorias}
          onConfirmar={handleEditarAssinaturaConfirmar}
          onAlterarLimite={
            editandoAssinatura.cartaoId === null
              ? (recorreAte) => handleAlterarLimite(editandoAssinatura.id, recorreAte)
              : undefined
          }
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
      {/* O mesmo diálogo de Faturas, que nomeia a despesa. Este dizia "TODAS"
          em caixa alta e avisava que a ação podia falhar depois de confirmada. */}
      {confirmacao?.tipo === 'excluir' && (
        <DialogoExcluirDespesa
          despesa={confirmacao.despesa}
          onConfirmar={() => confirmarExcluir(confirmacao.despesa)}
          onCancelar={() => setConfirmacao(null)}
        />
      )}
    </PageContainer>
  )
}
